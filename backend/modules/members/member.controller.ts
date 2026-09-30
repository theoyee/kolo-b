import { FastifyRequest, FastifyReply } from 'fastify';
import { memberService } from './member.service';
import { addMemberSchema, updateMemberSchema } from './member.schemas';

export class MemberController {
  async listMembers(request: FastifyRequest, reply: FastifyReply) {
    const result = await memberService.listMembers(request.tenant!.businessId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async addMember(request: FastifyRequest, reply: FastifyReply) {
    const input = addMemberSchema.parse(request.body);
    const result = await memberService.addMember(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(201).send({
      success: true,
      message: 'Member added to business',
      data: result,
    });
  }

  async updateMember(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = updateMemberSchema.parse(request.body);
    const result = await memberService.updateMember(
      request.tenant!.businessId,
      id,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: 'Member updated successfully',
      data: result,
    });
  }

  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await memberService.removeMember(
      request.tenant!.businessId,
      id,
      request.user!.userId
    );
    return reply.status(200).send(result);
  }
}

export const memberController = new MemberController();
