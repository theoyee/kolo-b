import { FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from './report.service';

export class ReportController {
  async getDailySummary(request: FastifyRequest, reply: FastifyReply) {
    const { date } = request.query as { date?: string };
    const result = await reportService.getDailySummary(request.tenant!.businessId, date);
    return reply.status(200).send({ success: true, data: result });
  }

  async getProfitLoss(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };
    const result = await reportService.getProfitLoss(request.tenant!.businessId, startDate, endDate);
    return reply.status(200).send({ success: true, data: result });
  }

  async getTopSellingProducts(request: FastifyRequest, reply: FastifyReply) {
    const { limit } = request.query as { limit?: string };
    const result = await reportService.getTopSellingProducts(
      request.tenant!.businessId,
      limit ? parseInt(limit, 10) : 10
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async getInventoryValuation(request: FastifyRequest, reply: FastifyReply) {
    const result = await reportService.getInventoryValuation(request.tenant!.businessId);
    return reply.status(200).send({ success: true, data: result });
  }
}

export const reportController = new ReportController();
