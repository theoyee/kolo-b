import bcrypt from 'bcryptjs';
import prisma from '../../db/prisma';
import { AddMemberInput, UpdateMemberInput } from './member.schemas';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors';
import { ROLE_PERMISSIONS, Role } from '../../types';
import { recordAuditLog } from '../../middlewares/audit';

export class MemberService {
  async listMembers(businessId: string) {
    const members = await prisma.member.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      permissions: m.permissions.length > 0 ? m.permissions : ROLE_PERMISSIONS[m.role as Role] || [],
      isActive: m.isActive,
      user: m.user,
      createdAt: m.createdAt,
    }));
  }

  async addMember(businessId: string, actorUserId: string, input: AddMemberInput) {
    let user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      const tempPasswordHash = await bcrypt.hash('KoloSME#2026', 10);
      user = await prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash: tempPasswordHash,
          firstName: input.firstName || 'Staff',
          lastName: input.lastName || 'Member',
        },
      });
    }

    const existingMembership = await prisma.member.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } },
    });

    if (existingMembership) {
      if (!existingMembership.isActive) {
        const reactivated = await prisma.member.update({
          where: { id: existingMembership.id },
          data: {
            isActive: true,
            role: input.role,
            permissions: input.permissions || ROLE_PERMISSIONS[input.role],
          },
          include: { user: true },
        });
        return reactivated;
      }
      throw new ConflictError('User is already an active member of this business');
    }

    const member = await prisma.member.create({
      data: {
        userId: user.id,
        businessId,
        role: input.role,
        permissions: input.permissions || ROLE_PERMISSIONS[input.role],
        isActive: true,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });

    await recordAuditLog({
      businessId,
      userId: actorUserId,
      action: 'MEMBER_INVITED',
      entity: 'Member',
      entityId: member.id,
      details: { email: input.email, role: input.role },
    });

    return member;
  }

  async updateMember(businessId: string, memberId: string, actorUserId: string, input: UpdateMemberInput) {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundError('Member not found');

    if (member.role === 'OWNER' && input.role && input.role !== 'OWNER') {
      const ownerCount = await prisma.member.count({
        where: { businessId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        throw new BadRequestError('Cannot change the role of the sole OWNER.');
      }
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: {
        role: input.role,
        permissions: input.permissions,
        isActive: input.isActive,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await recordAuditLog({
      businessId,
      userId: actorUserId,
      action: 'MEMBER_UPDATED',
      entity: 'Member',
      entityId: memberId,
      details: input,
    });

    return updated;
  }

  async removeMember(businessId: string, memberId: string, actorUserId: string) {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundError('Member not found');

    if (member.role === 'OWNER') {
      const ownerCount = await prisma.member.count({
        where: { businessId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        throw new BadRequestError('Cannot remove the sole OWNER.');
      }
    }

    await prisma.member.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    await recordAuditLog({
      businessId,
      userId: actorUserId,
      action: 'MEMBER_DEACTIVATED',
      entity: 'Member',
      entityId: memberId,
    });

    return { success: true, message: 'Member deactivated successfully' };
  }
}

export const memberService = new MemberService();
