import { FastifyInstance } from 'fastify';
import { paymentController } from './payment.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';
import { handleIdempotency } from '../../middlewares/idempotency';

export async function paymentRoutes(fastify: FastifyInstance) {
  // Public Webhook endpoints for Paystack and Flutterwave (Kept for future activation)
  fastify.post(
    '/webhooks/paystack',
    {
      schema: {
        tags: ['Payments & Bank Transfers'],
        summary: 'Paystack Payment Gateway Webhook (Optional/Future)',
        description: 'Receives and verifies HMAC-SHA512 webhook events from Paystack',
      },
    },
    paymentController.handlePaystackWebhook.bind(paymentController)
  );

  fastify.post(
    '/webhooks/flutterwave',
    {
      schema: {
        tags: ['Payments & Bank Transfers'],
        summary: 'Flutterwave Payment Gateway Webhook (Optional/Future)',
        description: 'Receives and verifies secret-hash webhook events from Flutterwave',
      },
    },
    paymentController.handleFlutterwaveWebhook.bind(paymentController)
  );

  // Authenticated tenant routes
  fastify.register(async function (tenantContext) {
    tenantContext.addHook('preHandler', authenticate);
    tenantContext.addHook('preHandler', resolveTenant);

    // 1. Get Business Official Account Details for Transfer
    tenantContext.get(
      '/bank-account',
      {
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'Get Business Official Bank Account Details for Transfers',
          description: 'Returns the business bank name, 10-digit NUBAN account number, account name, and payment instructions',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
        },
      },
      paymentController.getBusinessBankDetails.bind(paymentController)
    );

    // 2. Submit Direct Bank Transfer with Receipt Proof (Status: PENDING)
    tenantContext.post(
      '/bank-transfer',
      {
        preHandler: [handleIdempotency],
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'Submit Bank Transfer with Receipt Proof (Primary Payment Flow)',
          description: 'Customers or staff transfer to the business account and submit transaction reference and uploaded receipt proof. Status is marked PENDING until an admin verifies it.',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
          body: {
            type: 'object',
            required: ['amountKobo', 'transferReference', 'receiptUrl', 'senderName', 'senderBank'],
            properties: {
              saleId: { type: 'string', format: 'uuid' },
              orderId: { type: 'string', format: 'uuid' },
              customerId: { type: 'string', format: 'uuid' },
              amountKobo: { type: 'integer', minimum: 1, description: 'Amount transferred in kobo' },
              transferReference: { type: 'string', description: 'NIBSS Session ID / Bank Reference' },
              receiptUrl: { type: 'string', description: 'URL of uploaded transfer receipt image / proof' },
              senderName: { type: 'string', description: 'Name of the account that sent the transfer' },
              senderBank: { type: 'string', description: 'Payer bank (e.g., GTBank, Access, OPay, Kuda)' },
              notes: { type: 'string' },
            },
          },
        },
      },
      paymentController.submitBankTransfer.bind(paymentController)
    );

    // 3. List Pending Transfers Awaiting Admin Verification
    tenantContext.get(
      '/pending-transfers',
      {
        preHandler: [requirePermission('payments:manage')],
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'List pending bank transfer receipts awaiting admin verification',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
        },
      },
      paymentController.listPendingTransfers.bind(paymentController)
    );

    // 4. Admin Verifies / Approves Bank Transfer Receipt
    tenantContext.post(
      '/:id/verify-transfer',
      {
        preHandler: [requirePermission('payments:manage')],
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'Admin Verifies & Approves Transfer Receipt',
          description: 'Any admin or manager verifies receipt proof against business bank statement. On approval, marks payment SUCCESS, updates sale balance, and adjusts customer ledger.',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
          params: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
          body: {
            type: 'object',
            required: ['status'],
            properties: {
              status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
              adminNotes: { type: 'string', description: 'e.g. "Confirmed on Moniepoint app at 10:45 AM"' },
            },
          },
        },
      },
      paymentController.verifyTransferPayment.bind(paymentController)
    );

    // 5. General Record Payment (Cash, POS, Direct)
    tenantContext.post(
      '/',
      {
        preHandler: [requirePermission('payments:manage'), handleIdempotency],
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'Record manual or immediate payment with idempotency',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
        },
      },
      paymentController.recordPayment.bind(paymentController)
    );

    // 6. List Payments
    tenantContext.get(
      '/',
      {
        preHandler: [requirePermission('payments:read')],
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'List all payment transactions with filters',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
        },
      },
      paymentController.listPayments.bind(paymentController)
    );

    // 7. Online checkout link (Paystack / Flutterwave)
    tenantContext.post(
      '/initialize-online',
      {
        preHandler: [requirePermission('payments:manage')],
        schema: {
          tags: ['Payments & Bank Transfers'],
          summary: 'Initialize online checkout link (Paystack/Flutterwave - dormant)',
          security: [{ BearerAuth: [] }, { 'BusinessId Header': [] }],
        },
      },
      paymentController.initializeOnlinePayment.bind(paymentController)
    );
  });
}
