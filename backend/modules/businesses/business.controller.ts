import { FastifyRequest, FastifyReply } from 'fastify';
import { businessService } from './business.service';
import { createBusinessSchema, updateBusinessSchema } from './business.schemas';

export class BusinessController {
  async createBusiness(request: FastifyRequest, reply: FastifyReply) {
    const input = createBusinessSchema.parse(request.body);
    const result = await businessService.createBusiness(request.user!.userId, input);
    return reply.status(201).send({
      success: true,
      message: 'Business created successfully',
      data: result,
    });
  }

  async getUserBusinesses(request: FastifyRequest, reply: FastifyReply) {
    const result = await businessService.getUserBusinesses(request.user!.userId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async getBusinessById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await businessService.getBusinessById(id, request.user!.userId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async updateBusiness(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = updateBusinessSchema.parse(request.body);
    const result = await businessService.updateBusiness(id, request.user!.userId, input);
    return reply.status(200).send({
      success: true,
      message: 'Business updated successfully',
      data: result,
    });
  }
}

export const businessController = new BusinessController();
