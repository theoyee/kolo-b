import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../errors';
import prisma from '../db/prisma';
import { Role, ROLE_PERMISSIONS } from '../types';

export async function resolveTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required before tenant resolution');
  }

  let businessId =
    (request.headers['x-business-id'] as string) ||
    (request.params as any)?.businessId ||
    (request.query as any)?.businessId;

  if (!businessId) {
    const defaultMembership = await prisma.member.findFirst({
      where: { userId: user.userId, isActive: true },
      include: { business: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!defaultMembership) {
      throw new BadRequestError('No business selected and user belongs to no active businesses.');
    }

    businessId = defaultMembership.businessId;
    request.tenant = {
      businessId: defaultMembership.businessId,
      businessName: defaultMembership.business.name,
      memberId: defaultMembership.id,
      role: defaultMembership.role as Role,
      permissions:
        defaultMembership.permissions.length > 0
          ? defaultMembership.permissions
          : ROLE_PERMISSIONS[defaultMembership.role as Role] || [],
    };
    return;
  }

  const membership = await prisma.member.findUnique({
    where: {
      userId_businessId: {
        userId: user.userId,
        businessId,
      },
    },
    include: { business: true },
  });

  if (!membership || !membership.isActive) {
    if (user.isSuperAdmin) {
      const biz = await prisma.business.findUnique({ where: { id: businessId } });
      if (biz) {
        request.tenant = {
          businessId: biz.id,
          businessName: biz.name,
          memberId: 'super-admin-virtual-member',
          role: 'OWNER',
          permissions: ['*'],
        };
        return;
      }
    }
    throw new ForbiddenError('You do not have access to this business or your membership is inactive');
  }

  request.tenant = {
    businessId: membership.businessId,
    businessName: membership.business.name,
    memberId: membership.id,
    role: membership.role as Role,
    permissions:
      membership.permissions.length > 0
        ? membership.permissions
        : ROLE_PERMISSIONS[membership.role as Role] || [],
  };
}
