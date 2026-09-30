import { FastifyInstance } from 'fastify';
import { memberController } from './member.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission, requireRole } from '../../middlewares/rbac';

export async function memberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.get('/', { preHandler: [requirePermission('members:read')] }, memberController.listMembers.bind(memberController));
  fastify.post('/invite', { preHandler: [requireRole(['OWNER', 'ADMIN'])] }, memberController.addMember.bind(memberController));
  fastify.patch('/:id', { preHandler: [requireRole(['OWNER', 'ADMIN'])] }, memberController.updateMember.bind(memberController));
  fastify.delete('/:id', { preHandler: [requireRole(['OWNER', 'ADMIN'])] }, memberController.removeMember.bind(memberController));
}
