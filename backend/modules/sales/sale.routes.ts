import { FastifyInstance } from 'fastify';
import { saleController } from './sale.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';
import { handleIdempotency } from '../../middlewares/idempotency';

export async function saleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.post('/', { preHandler: [requirePermission('sales:create'), handleIdempotency] }, saleController.createSale.bind(saleController));
  fastify.get('/', { preHandler: [requirePermission('sales:read')] }, saleController.listSales.bind(saleController));
  fastify.get('/:id', { preHandler: [requirePermission('sales:read')] }, saleController.getSaleById.bind(saleController));
  fastify.get('/:id/receipt-pdf', { preHandler: [requirePermission('sales:read')] }, saleController.downloadReceiptPdf.bind(saleController));
  fastify.get('/verify/:saleNumber', { preHandler: [requirePermission('sales:read')] }, saleController.verifyReceipt.bind(saleController));
  fastify.post('/:id/void', { preHandler: [requirePermission('sales:void')] }, saleController.voidSale.bind(saleController));
}
