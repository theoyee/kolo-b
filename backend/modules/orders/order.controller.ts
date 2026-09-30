import { FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from './order.service';
import { createOrderSchema, updateOrderStatusSchema } from './order.schemas';

export class OrderController {
  async createOrder(request: FastifyRequest, reply: FastifyReply) {
    const input = createOrderSchema.parse(request.body);
    const result = await orderService.createOrder(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(201).send({
      success: true,
      message: 'Order quotation created successfully',
      data: result,
    });
  }

  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    const result = await orderService.listOrders(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  async getOrderById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await orderService.getOrderById(request.tenant!.businessId, id);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = updateOrderStatusSchema.parse(request.body);
    const result = await orderService.updateOrderStatus(
      request.tenant!.businessId,
      id,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: 'Order status updated',
      data: result,
    });
  }

  async convertOrderToSale(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { payments } = request.body as { payments: any[] };
    const result = await orderService.convertOrderToSale(
      request.tenant!.businessId,
      id,
      request.tenant!.memberId,
      request.user!.userId,
      payments || [{ method: 'CASH', amountKobo: 0 }]
    );
    return reply.status(201).send({
      success: true,
      message: 'Order fulfilled into completed Sale',
      data: result,
    });
  }
}

export const orderController = new OrderController();
