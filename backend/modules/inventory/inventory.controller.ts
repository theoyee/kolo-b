import { FastifyRequest, FastifyReply } from 'fastify';
import { inventoryService } from './inventory.service';
import { adjustStockSchema } from './inventory.schemas';

export class InventoryController {
  async adjustStock(request: FastifyRequest, reply: FastifyReply) {
    const input = adjustStockSchema.parse(request.body);
    const result = await inventoryService.adjustStock(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: 'Inventory adjusted successfully',
      data: result,
    });
  }

  async getMovements(request: FastifyRequest, reply: FastifyReply) {
    const result = await inventoryService.getMovements(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  async getLowStockAlerts(request: FastifyRequest, reply: FastifyReply) {
    const result = await inventoryService.getLowStockAlerts(request.tenant!.businessId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const inventoryController = new InventoryController();
