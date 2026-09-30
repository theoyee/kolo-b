import { FastifyRequest, FastifyReply } from 'fastify';
import { saleService } from './sale.service';
import { receiptService } from './receipt.service';
import { createSaleSchema } from './sale.schemas';

export class SaleController {
  async createSale(request: FastifyRequest, reply: FastifyReply) {
    const input = createSaleSchema.parse(request.body);
    const result = await saleService.createSale(
      request.tenant!.businessId,
      request.tenant!.memberId,
      request.user!.userId,
      input,
      request.idempotencyKey
    );
    return reply.status(201).send({
      success: true,
      message: 'Sale completed successfully',
      data: result,
    });
  }

  async listSales(request: FastifyRequest, reply: FastifyReply) {
    const result = await saleService.listSales(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  async getSaleById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await saleService.getSaleById(request.tenant!.businessId, id);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async downloadReceiptPdf(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { download } = (request.query as any) || {};
    const { buffer, fileName } = await receiptService.generateReceiptPdf(
      request.tenant!.businessId,
      id
    );

    const disposition = download === 'true' ? 'attachment' : 'inline';

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `${disposition}; filename="${fileName}"`)
      .header('Content-Length', buffer.length)
      .send(buffer);
  }

  async verifyReceipt(request: FastifyRequest, reply: FastifyReply) {
    const { saleNumber } = request.params as { saleNumber: string };
    const result = await receiptService.verifyReceiptData(
      request.tenant!.businessId,
      saleNumber
    );
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async voidSale(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { reason } = (request.body as any) || { reason: 'Customer requested cancellation' };
    const result = await saleService.voidSale(
      request.tenant!.businessId,
      id,
      request.user!.userId,
      reason || 'Sale voided by administrator'
    );
    return reply.status(200).send(result);
  }
}

export const saleController = new SaleController();

