import { FastifyRequest, FastifyReply } from 'fastify';
import { customerService } from './customer.service';
import { createCustomerSchema, updateCustomerSchema } from './customer.schemas';

export class CustomerController {
  async listCustomers(request: FastifyRequest, reply: FastifyReply) {
    const result = await customerService.listCustomers(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  async getCustomerById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await customerService.getCustomerById(request.tenant!.businessId, id);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async createCustomer(request: FastifyRequest, reply: FastifyReply) {
    const input = createCustomerSchema.parse(request.body);
    const result = await customerService.createCustomer(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(201).send({
      success: true,
      message: 'Customer registered successfully',
      data: result,
    });
  }

  async updateCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = updateCustomerSchema.parse(request.body);
    const result = await customerService.updateCustomer(
      request.tenant!.businessId,
      id,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: 'Customer updated successfully',
      data: result,
    });
  }
}

export const customerController = new CustomerController();
