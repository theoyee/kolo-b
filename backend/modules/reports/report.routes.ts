import { FastifyInstance } from 'fastify';
import { reportController } from './report.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.get('/daily-summary', { preHandler: [requirePermission('reports:read')] }, reportController.getDailySummary.bind(reportController));
  fastify.get('/profit-loss', { preHandler: [requirePermission('reports:read')] }, reportController.getProfitLoss.bind(reportController));
  fastify.get('/top-products', { preHandler: [requirePermission('reports:read')] }, reportController.getTopSellingProducts.bind(reportController));
  fastify.get('/inventory-valuation', { preHandler: [requirePermission('reports:read')] }, reportController.getInventoryValuation.bind(reportController));
}
