import { FastifyInstance } from 'fastify';
import { customerController } from './customer.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';

export async function customerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.get('/', { preHandler: [requirePermission('customers:read')] }, customerController.listCustomers.bind(customerController));
  fastify.get('/:id', { preHandler: [requirePermission('customers:read')] }, customerController.getCustomerById.bind(customerController));
  fastify.post('/', { preHandler: [requirePermission('customers:manage')] }, customerController.createCustomer.bind(customerController));
  fastify.patch('/:id', { preHandler: [requirePermission('customers:manage')] }, customerController.updateCustomer.bind(customerController));
}
