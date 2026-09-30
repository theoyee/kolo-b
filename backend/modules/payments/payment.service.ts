import crypto from 'crypto';
import prisma from '../../db/prisma';
import { config } from '../../config';
import {
  RecordPaymentInput,
  SubmitBankTransferInput,
  VerifyTransferInput,
  InitializeOnlinePaymentInput,
} from './payment.schemas';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../../errors';
import { getPaginationParams, formatPaginatedResult, formatKoboToNaira } from '../../utils';
import { recordAuditLog } from '../../middlewares/audit';
import { saveIdempotentResponse } from '../../middlewares/idempotency';

export class PaymentService {
  async getBusinessBankDetails(businessId: string) {
    const settings = await prisma.businessSetting.findUnique({
      where: { businessId },
      include: {
        business: {
          select: { name: true, phone: true, email: true },
        },
      },
    });

    if (!settings) {
      throw new NotFoundError('Business settings not found');
    }

    return {
      businessName: settings.business.name,
      bankName: settings.bankName || 'Moniepoint Microfinance Bank',
      bankAccountNumber: settings.bankAccountNumber || '8239019201',
      bankAccountName: settings.bankAccountName || settings.business.name,
      instructions:
        settings.bankTransferInstructions ||
        'Make transfer to this official business account and upload your receipt or session ID for instant admin verification.',
      currency: 'NGN',
    };
  }

  async submitBankTransfer(businessId: string, input: SubmitBankTransferInput, idempotencyKey?: string) {
    const finalIdempotencyKey = input.idempotencyKey || idempotencyKey;

    if (finalIdempotencyKey) {
      const existing = await prisma.payment.findFirst({
        where: { businessId, idempotencyKey: finalIdempotencyKey },
      });
      if (existing) {
        return this.formatPaymentResponse(existing);
      }
    }

    if (input.saleId) {
      const sale = await prisma.sale.findUnique({ where: { id: input.saleId } });
      if (!sale || sale.businessId !== businessId) {
        throw new NotFoundError('Associated sale record was not found');
      }
    }

    const payment = await prisma.payment.create({
      data: {
        businessId,
        saleId: input.saleId || null,
        orderId: input.orderId || null,
        amount: BigInt(input.amountKobo),
        method: 'BANK_TRANSFER',
        reference: input.transferReference,
        status: 'PENDING',
        receiptUrl: input.receiptUrl,
        senderName: input.senderName,
        senderBank: input.senderBank,
        adminNotes: input.notes ? `Customer Note: ${input.notes}` : null,
        idempotencyKey: finalIdempotencyKey || null,
      },
    });

    await recordAuditLog({
      businessId,
      action: 'BANK_TRANSFER_SUBMITTED',
      entity: 'Payment',
      entityId: payment.id,
      details: {
        reference: payment.reference,
        amount: formatKoboToNaira(payment.amount),
        senderName: input.senderName,
        senderBank: input.senderBank,
      },
    });

    if (finalIdempotencyKey) {
      saveIdempotentResponse(`${businessId}:${finalIdempotencyKey}`, 201, {
        success: true,
        data: this.formatPaymentResponse(payment),
      });
    }

    return this.formatPaymentResponse(payment);
  }

  async verifyTransferPayment(
    businessId: string,
    paymentId: string,
    adminUserId: string,
    input: VerifyTransferInput
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { sale: true },
    });

    if (!payment || payment.businessId !== businessId) {
      throw new NotFoundError('Payment record not found');
    }

    if (payment.status === 'SUCCESS') {
      throw new BadRequestError('This payment receipt has already been verified and marked SUCCESS');
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: input.status,
          verifiedByUserId: adminUserId,
          verifiedAt: input.status === 'SUCCESS' ? new Date() : null,
          adminNotes: input.adminNotes
            ? `${payment.adminNotes ? payment.adminNotes + ' | ' : ''}Admin: ${input.adminNotes}`
            : payment.adminNotes,
        },
      });

      if (input.status === 'SUCCESS' && payment.saleId && payment.sale) {
        const sale = payment.sale;
        const newAmountPaid = Number(sale.amountPaid) + Number(payment.amount);
        const newBalanceDue = Math.max(0, Number(sale.grandTotal) - newAmountPaid);
        const newPaymentStatus = newBalanceDue === 0 ? 'SUCCESS' : 'PENDING';

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            amountPaid: BigInt(newAmountPaid),
            balanceDue: BigInt(newBalanceDue),
            paymentStatus: newPaymentStatus as any,
          },
        });

        if (sale.customerId) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              currentBalance: { decrement: payment.amount },
            },
          });
        }
      }

      return updatedPayment;
    });

    await recordAuditLog({
      businessId,
      userId: adminUserId,
      action: input.status === 'SUCCESS' ? 'BANK_TRANSFER_APPROVED' : 'BANK_TRANSFER_REJECTED',
      entity: 'Payment',
      entityId: paymentId,
      details: {
        reference: payment.reference,
        status: input.status,
        amount: formatKoboToNaira(payment.amount),
      },
    });

    return this.formatPaymentResponse(result);
  }

  async listPendingTransfers(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);

    const where = {
      businessId,
      method: 'BANK_TRANSFER' as const,
      status: 'PENDING' as const,
    };

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          sale: {
            select: { id: true, saleNumber: true, grandTotal: true, customer: { select: { fullName: true, phone: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = payments.map((p: any) => this.formatPaymentResponse(p));
    return formatPaginatedResult(formatted, total, page, limit);
  }

  async recordPayment(businessId: string, userId: string, input: RecordPaymentInput, idempotencyKey?: string) {
    const finalIdempotencyKey = input.idempotencyKey || idempotencyKey;

    if (finalIdempotencyKey) {
      const existing = await prisma.payment.findFirst({
        where: { businessId, idempotencyKey: finalIdempotencyKey },
      });
      if (existing) {
        return this.formatPaymentResponse(existing);
      }
    }

    const reference = input.reference || `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx: any) => {
      let updatedSale = null;
      if (input.saleId) {
        const sale = await tx.sale.findUnique({
          where: { id: input.saleId },
        });

        if (!sale || sale.businessId !== businessId) {
          throw new NotFoundError('Sale not found in this business');
        }

        const newAmountPaid = Number(sale.amountPaid) + input.amountKobo;
        const newBalanceDue = Math.max(0, Number(sale.grandTotal) - newAmountPaid);
        const paymentStatus = newBalanceDue === 0 ? 'SUCCESS' : 'PENDING';

        updatedSale = await tx.sale.update({
          where: { id: input.saleId },
          data: {
            amountPaid: BigInt(newAmountPaid),
            balanceDue: BigInt(newBalanceDue),
            paymentStatus: paymentStatus as any,
          },
        });

        if (sale.customerId) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              currentBalance: { decrement: BigInt(input.amountKobo) },
            },
          });
        }
      } else if (input.customerId) {
        await tx.customer.update({
          where: { id: input.customerId },
          data: {
            currentBalance: { decrement: BigInt(input.amountKobo) },
          },
        });
      }

      const payment = await tx.payment.create({
        data: {
          businessId,
          saleId: input.saleId || null,
          orderId: input.orderId || null,
          amount: BigInt(input.amountKobo),
          method: input.method,
          reference,
          status: 'SUCCESS',
          receiptUrl: input.receiptUrl || null,
          senderName: input.senderName || null,
          senderBank: input.senderBank || null,
          idempotencyKey: finalIdempotencyKey || null,
          verifiedByUserId: userId,
          verifiedAt: new Date(),
        },
      });

      return { payment, sale: updatedSale };
    });

    if (finalIdempotencyKey) {
      saveIdempotentResponse(`${businessId}:${finalIdempotencyKey}`, 201, {
        success: true,
        data: this.formatPaymentResponse(result.payment),
      });
    }

    await recordAuditLog({
      businessId,
      userId,
      action: 'PAYMENT_RECORDED',
      entity: 'Payment',
      entityId: result.payment.id,
      details: {
        amount: formatKoboToNaira(result.payment.amount),
        method: result.payment.method,
        reference: result.payment.reference,
      },
    });

    return this.formatPaymentResponse(result.payment);
  }

  async listPayments(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const method = query.method;
    const status = query.status;

    const where: any = { businessId };
    if (method) where.method = method;
    if (status) where.status = status;

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          sale: {
            select: { id: true, saleNumber: true, grandTotal: true, customer: { select: { fullName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = payments.map((p: any) => this.formatPaymentResponse(p));
    return formatPaginatedResult(formatted, total, page, limit);
  }

  async initializeOnlinePayment(businessId: string, input: InitializeOnlinePaymentInput) {
    const reference = `${input.gateway.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payment = await prisma.payment.create({
      data: {
        businessId,
        saleId: input.saleId || null,
        amount: BigInt(input.amountKobo),
        method: input.gateway,
        reference,
        status: 'PENDING',
      },
    });

    const checkoutUrl =
      input.gateway === 'PAYSTACK'
        ? `https://checkout.paystack.com/access_code_${reference}`
        : `https://checkout.flutterwave.com/v3/hosted/pay/${reference}`;

    return {
      reference,
      authorizationUrl: checkoutUrl,
      amountKobo: input.amountKobo,
      amountNaira: input.amountKobo / 100,
      paymentId: payment.id,
    };
  }

  verifyPaystackSignature(rawBody: string, signature: string): boolean {
    const hash = crypto.createHmac('sha512', config.paystack.secretKey).update(rawBody).digest('hex');
    return hash === signature;
  }

  verifyFlutterwaveSignature(receivedHash: string): boolean {
    return receivedHash === config.flutterwave.secretHash;
  }

  async handlePaystackWebhook(rawBody: string, signature: string, eventData: any) {
    const isValid = this.verifyPaystackSignature(rawBody, signature);
    if (!isValid) throw new UnauthorizedError('Invalid Paystack webhook signature');
    const { event, data } = eventData;
    if (event === 'charge.success') {
      const reference = data.reference;
      const existingPayment = await prisma.payment.findFirst({ where: { reference } });
      if (existingPayment && existingPayment.status !== 'SUCCESS') {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: 'SUCCESS',
            channelData: data,
            verifiedAt: new Date(),
          },
        });
      }
    }
    return { success: true };
  }

  async handleFlutterwaveWebhook(secretHashHeader: string, eventData: any) {
    const isValid = this.verifyFlutterwaveSignature(secretHashHeader);
    if (!isValid) throw new UnauthorizedError('Invalid Flutterwave secret hash signature');
    if (eventData.event === 'charge.completed' && eventData.data?.status === 'successful') {
      const reference = eventData.data.tx_ref;
      const existingPayment = await prisma.payment.findFirst({ where: { reference } });
      if (existingPayment && existingPayment.status !== 'SUCCESS') {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: 'SUCCESS',
            channelData: eventData.data,
            verifiedAt: new Date(),
          },
        });
      }
    }
    return { success: true };
  }

  private formatPaymentResponse(payment: any) {
    return {
      id: payment.id,
      businessId: payment.businessId,
      saleId: payment.saleId,
      orderId: payment.orderId,
      amountKobo: Number(payment.amount),
      amountNaira: Number(payment.amount) / 100,
      formattedNaira: formatKoboToNaira(payment.amount),
      method: payment.method,
      reference: payment.reference,
      status: payment.status,
      receiptUrl: payment.receiptUrl,
      senderName: payment.senderName,
      senderBank: payment.senderBank,
      adminNotes: payment.adminNotes,
      verifiedByUserId: payment.verifiedByUserId,
      verifiedAt: payment.verifiedAt,
      createdAt: payment.createdAt,
      sale: payment.sale,
    };
  }
}

export const paymentService = new PaymentService();
