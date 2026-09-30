import { FastifyInstance } from 'fastify';
import { businessController } from './business.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requireRole } from '../../middlewares/rbac';

export async function businessRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', businessController.createBusiness.bind(businessController));
  fastify.get('/', businessController.getUserBusinesses.bind(businessController));
  fastify.get('/:id', { preHandler: [resolveTenant] }, businessController.getBusinessById.bind(businessController));
  fastify.patch('/:id', { preHandler: [resolveTenant, requireRole(['OWNER', 'ADMIN'])] }, businessController.updateBusiness.bind(businessController));
}
