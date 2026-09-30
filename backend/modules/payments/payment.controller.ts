import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from './payment.service';
import {
  recordPaymentSchema,
  submitBankTransferSchema,
  verifyTransferSchema,
  initializeOnlinePaymentSchema,
} from './payment.schemas';

export class PaymentController {
  // Get official business bank account for transfers
  async getBusinessBankDetails(request: FastifyRequest, reply: FastifyReply) {
    const result = await paymentService.getBusinessBankDetails(request.tenant!.businessId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  // Customer or cashier submits bank transfer with receipt
  async submitBankTransfer(request: FastifyRequest, reply: FastifyReply) {
    const input = submitBankTransferSchema.parse(request.body);
    const result = await paymentService.submitBankTransfer(
      request.tenant!.businessId,
      input,
      request.idempotencyKey
    );
    return reply.status(201).send({
      success: true,
      message: 'Bank transfer receipt submitted. Awaiting admin verification.',
      data: result,
    });
  }

  // Admin verifies and approves/rejects receipt
  async verifyTransferPayment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = verifyTransferSchema.parse(request.body);
    const result = await paymentService.verifyTransferPayment(
      request.tenant!.businessId,
      id,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: input.status === 'SUCCESS' ? 'Transfer verified and sale marked PAID' : 'Transfer marked as FAILED',
      data: result,
    });
  }

  // List pending transfers for admin review
  async listPendingTransfers(request: FastifyRequest, reply: FastifyReply) {
    const result = await paymentService.listPendingTransfers(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  // Manual payment recording (Cash, POS, etc.)
  async recordPayment(request: FastifyRequest, reply: FastifyReply) {
    const input = recordPaymentSchema.parse(request.body);
    const result = await paymentService.recordPayment(
      request.tenant!.businessId,
      request.user!.userId,
      input,
      request.idempotencyKey
    );
    return reply.status(201).send({
      success: true,
      message: 'Payment recorded successfully',
      data: result,
    });
  }

  // List all payments
  async listPayments(request: FastifyRequest, reply: FastifyReply) {
    const result = await paymentService.listPayments(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  // Online gateway initialization (Paystack / Flutterwave)
  async initializeOnlinePayment(request: FastifyRequest, reply: FastifyReply) {
    const input = initializeOnlinePaymentSchema.parse(request.body);
    const result = await paymentService.initializeOnlinePayment(request.tenant!.businessId, input);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  // Webhooks
  async handlePaystackWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature = request.headers['x-paystack-signature'] as string;
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);
    const result = await paymentService.handlePaystackWebhook(rawBody, signature, request.body);
    return reply.status(200).send(result);
  }

  async handleFlutterwaveWebhook(request: FastifyRequest, reply: FastifyReply) {
    const secretHash = request.headers['verif-hash'] as string;
    const result = await paymentService.handleFlutterwaveWebhook(secretHash, request.body);
    return reply.status(200).send(result);
  }
}

export const paymentController = new PaymentController();
