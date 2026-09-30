import prisma from '../../db/prisma';
import { CreateSaleInput } from './sale.schemas';
import { NotFoundError, BadRequestError, InsufficientStockError } from '../../errors';
import { getPaginationParams, formatPaginatedResult, formatKoboToNaira } from '../../utils';
import { notificationQueue } from '../../queue/bullmq';
import { recordAuditLog } from '../../middlewares/audit';
import { saveIdempotentResponse } from '../../middlewares/idempotency';

export class SaleService {
  async createSale(
    businessId: string,
    cashierMemberId: string,
    userId: string,
    input: CreateSaleInput,
    idempotencyKey?: string
  ) {
    const finalIdempotencyKey = input.idempotencyKey || idempotencyKey;

    if (finalIdempotencyKey) {
      const existingSale = await prisma.sale.findFirst({
        where: { businessId, idempotencyKey: finalIdempotencyKey },
        include: { items: true, payments: true, customer: true },
      });

      if (existingSale) {
        return this.formatSaleResponse(existingSale);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const settings = await tx.businessSetting.findUnique({ where: { businessId } });
      const allowNegativeStock = settings?.allowNegativeStock ?? false;
      const vatRateBps = settings?.vatRateBps ?? 750;

      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, businessId, isActive: true },
      });

      if (products.length !== productIds.length) {
        throw new BadRequestError('One or more selected products are invalid or belong to another business');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of input.items) {
        const prod = productMap.get(item.productId)!;
        const projectedStock = prod.currentStock - item.quantity;
        if (projectedStock < 0 && !allowNegativeStock) {
          throw new InsufficientStockError(
            `Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${item.quantity}`,
            { productId: prod.id, productName: prod.name, availableStock: prod.currentStock }
          );
        }
      }

      let subtotalKobo = 0;
      const processedItems = input.items.map((item) => {
        const prod = productMap.get(item.productId)!;
        const unitSellingPriceKobo =
          item.unitSellingPriceKobo !== undefined
            ? item.unitSellingPriceKobo
            : Number(prod.sellingPrice);
        const unitCostPriceKobo = Number(prod.costPrice);
        const itemSubtotal = unitSellingPriceKobo * item.quantity;
        const itemDiscount = item.discountAmountKobo || 0;
        const itemTotal = Math.max(0, itemSubtotal - itemDiscount);

        subtotalKobo += itemTotal;

        return {
          productId: prod.id,
          productName: prod.name,
          quantity: item.quantity,
          unitCostPrice: BigInt(unitCostPriceKobo),
          unitSellingPrice: BigInt(unitSellingPriceKobo),
          subtotal: BigInt(itemSubtotal),
          discountAmount: BigInt(itemDiscount),
          total: BigInt(itemTotal),
        };
      });

      const globalDiscountKobo = input.discountAmountKobo || 0;
      const discountedSubtotal = Math.max(0, subtotalKobo - globalDiscountKobo);
      const taxKobo = input.applyVat ? Math.round((discountedSubtotal * vatRateBps) / 10000) : 0;
      const grandTotalKobo = discountedSubtotal + taxKobo;

      const totalPaidKobo = input.payments.reduce((acc, p) => acc + p.amountKobo, 0);
      const balanceDueKobo = Math.max(0, grandTotalKobo - totalPaidKobo);
      const paymentStatus = balanceDueKobo === 0 ? 'SUCCESS' : totalPaidKobo > 0 ? 'PENDING' : 'FAILED';

      const saleCount = await tx.sale.count({ where: { businessId } });
      const saleNumber = `SALE-${new Date().getFullYear()}-${String(saleCount + 1).padStart(5, '0')}`;

      const sale = await tx.sale.create({
        data: {
          businessId,
          saleNumber,
          customerId: input.customerId || null,
          cashierId: cashierMemberId || null,
          subtotal: BigInt(subtotalKobo),
          discountAmount: BigInt(globalDiscountKobo),
          taxAmount: BigInt(taxKobo),
          grandTotal: BigInt(grandTotalKobo),
          amountPaid: BigInt(totalPaidKobo),
          balanceDue: BigInt(balanceDueKobo),
          paymentStatus: paymentStatus as any,
          status: 'COMPLETED',
          idempotencyKey: finalIdempotencyKey || null,
          notes: input.notes || null,
          items: { create: processedItems },
        },
        include: { items: true },
      });

      const lowStockProductsToAlert: Array<{ id: string; name: string; current: number; min: number }> = [];

      for (const item of input.items) {
        const prod = productMap.get(item.productId)!;
        const newStock = prod.currentStock - item.quantity;

        await tx.product.update({
          where: { id: prod.id },
          data: { currentStock: newStock },
        });

        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: prod.id,
            type: 'SALE_DEDUCTION',
            quantity: -item.quantity,
            previousStock: prod.currentStock,
            newStock,
            reason: `Sale #${saleNumber}`,
            referenceId: sale.id,
            createdByUserId: userId,
          },
        });

        if (newStock <= prod.minStockAlert) {
          lowStockProductsToAlert.push({
            id: prod.id,
            name: prod.name,
            current: newStock,
            min: prod.minStockAlert,
          });
        }
      }

      const createdPayments = [];
      for (const pay of input.payments) {
        const ref = pay.reference || `PAY-${sale.id.slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const pRecord = await tx.payment.create({
          data: {
            businessId,
            saleId: sale.id,
            amount: BigInt(pay.amountKobo),
            method: pay.method,
            reference: ref,
            status: 'SUCCESS',
            receiptUrl: pay.receiptUrl || null,
            idempotencyKey: finalIdempotencyKey ? `${finalIdempotencyKey}-${pay.method}` : null,
            verifiedAt: new Date(),
          },
        });
        createdPayments.push(pRecord);
      }

      let customerRecord = null;
      if (input.customerId) {
        customerRecord = await tx.customer.update({
          where: { id: input.customerId },
          data: {
            totalPurchases: { increment: BigInt(grandTotalKobo) },
            currentBalance: { increment: BigInt(balanceDueKobo) },
          },
        });
      }

      return { sale, payments: createdPayments, customer: customerRecord, lowStockProductsToAlert };
    });

    if (finalIdempotencyKey) {
      saveIdempotentResponse(`${businessId}:${finalIdempotencyKey}`, 201, {
        success: true,
        data: this.formatSaleResponse({
          ...result.sale,
          payments: result.payments,
          customer: result.customer,
        }),
      });
    }

    for (const alert of result.lowStockProductsToAlert) {
      await notificationQueue.add('check_low_stock_alert', {
        businessId,
        productId: alert.id,
        productName: alert.name,
        currentStock: alert.current,
        threshold: alert.min,
      });
    }

    if (result.customer?.phone || result.customer?.email) {
      await notificationQueue.add('send_receipt_notification', {
        businessId,
        saleId: result.sale.id,
        saleNumber: result.sale.saleNumber,
        customerPhone: result.customer.phone || undefined,
        customerEmail: result.customer.email || undefined,
        amountKobo: Number(result.sale.grandTotal),
      });
    }

    await recordAuditLog({
      businessId,
      userId,
      action: 'SALE_CREATED',
      entity: 'Sale',
      entityId: result.sale.id,
      details: {
        saleNumber: result.sale.saleNumber,
        grandTotal: formatKoboToNaira(result.sale.grandTotal),
      },
    });

    return this.formatSaleResponse({
      ...result.sale,
      payments: result.payments,
      customer: result.customer,
    });
  }

  async listSales(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const customerId = query.customerId;
    const status = query.status;

    const where: any = { businessId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip,
        take,
        include: {
          items: true,
          payments: true,
          customer: { select: { id: true, fullName: true, phone: true } },
          cashier: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = sales.map((s) => this.formatSaleResponse(s));
    return formatPaginatedResult(formatted, total, page, limit);
  }

  async getSaleById(businessId: string, saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        customer: true,
        cashier: { include: { user: true } },
        business: { include: { settings: true } },
      },
    });

    if (!sale || sale.businessId !== businessId) {
      throw new NotFoundError('Sale not found');
    }

    return this.formatSaleResponse(sale);
  }

  async voidSale(businessId: string, saleId: string, userId: string, reason: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale || sale.businessId !== businessId) throw new NotFoundError('Sale not found');
    if (sale.status === 'VOIDED') throw new BadRequestError('Sale has already been voided');

    const voided = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'VOIDED',
          notes: `${sale.notes ? sale.notes + ' | ' : ''}VOIDED: ${reason}`,
        },
      });

      for (const item of sale.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod) {
          const newStock = prod.currentStock + item.quantity;
          await tx.product.update({
            where: { id: prod.id },
            data: { currentStock: newStock },
          });

          await tx.inventoryMovement.create({
            data: {
              businessId,
              productId: prod.id,
              type: 'RETURN',
              quantity: item.quantity,
              previousStock: prod.currentStock,
              newStock,
              reason: `Sale Void #${sale.saleNumber}: ${reason}`,
              referenceId: sale.id,
              createdByUserId: userId,
            },
          });
        }
      }

      if (sale.customerId && Number(sale.balanceDue) > 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            currentBalance: { decrement: sale.balanceDue },
            totalPurchases: { decrement: sale.grandTotal },
          },
        });
      }

      return updated;
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'SALE_VOIDED',
      entity: 'Sale',
      entityId: saleId,
      details: { saleNumber: sale.saleNumber, reason },
    });

    return {
      success: true,
      message: `Sale ${sale.saleNumber} has been successfully voided and inventory restored`,
    };
  }

  private formatSaleResponse(sale: any) {
    return {
      id: sale.id,
      businessId: sale.businessId,
      saleNumber: sale.saleNumber,
      customerId: sale.customerId,
      customer: sale.customer,
      subtotalKobo: Number(sale.subtotal),
      discountAmountKobo: Number(sale.discountAmount),
      taxAmountKobo: Number(sale.taxAmount),
      grandTotalKobo: Number(sale.grandTotal),
      amountPaidKobo: Number(sale.amountPaid),
      balanceDueKobo: Number(sale.balanceDue),
      subtotalNaira: Number(sale.subtotal) / 100,
      grandTotalNaira: Number(sale.grandTotal) / 100,
      amountPaidNaira: Number(sale.amountPaid) / 100,
      balanceDueNaira: Number(sale.balanceDue) / 100,
      paymentStatus: sale.paymentStatus,
      status: sale.status,
      idempotencyKey: sale.idempotencyKey,
      notes: sale.notes,
      createdAt: sale.createdAt,
      items: sale.items?.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitSellingPriceKobo: Number(item.unitSellingPrice),
        subtotalKobo: Number(item.subtotal),
        totalKobo: Number(item.total),
      })),
      payments: sale.payments?.map((p: any) => ({
        id: p.id,
        amountKobo: Number(p.amount),
        amountNaira: Number(p.amount) / 100,
        method: p.method,
        reference: p.reference,
        status: p.status,
        receiptUrl: p.receiptUrl,
      })),
      receiptFormatted: {
        receiptNumber: sale.saleNumber,
        formattedTotal: formatKoboToNaira(sale.grandTotal),
        currency: 'NGN',
      },
    };
  }
}

export const saleService = new SaleService();
