import { FastifyInstance } from 'fastify';
import { inventoryController } from './inventory.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.post('/adjust', { preHandler: [requirePermission('inventory:adjust')] }, inventoryController.adjustStock.bind(inventoryController));
  fastify.get('/movements', { preHandler: [requirePermission('inventory:read')] }, inventoryController.getMovements.bind(inventoryController));
  fastify.get('/low-stock', { preHandler: [requirePermission('inventory:read')] }, inventoryController.getLowStockAlerts.bind(inventoryController));
}
