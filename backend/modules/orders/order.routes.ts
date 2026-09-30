import { FastifyInstance } from 'fastify';
import { orderController } from './order.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';

export async function orderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.post('/', { preHandler: [requirePermission('orders:manage')] }, orderController.createOrder.bind(orderController));
  fastify.get('/', { preHandler: [requirePermission('orders:read')] }, orderController.listOrders.bind(orderController));
  fastify.get('/:id', { preHandler: [requirePermission('orders:read')] }, orderController.getOrderById.bind(orderController));
  fastify.patch('/:id/status', { preHandler: [requirePermission('orders:manage')] }, orderController.updateOrderStatus.bind(orderController));
  fastify.post('/:id/fulfill', { preHandler: [requirePermission('sales:create')] }, orderController.convertOrderToSale.bind(orderController));
}
