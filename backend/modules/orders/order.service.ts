import prisma from '../../db/prisma';
import { CreateOrderInput, UpdateOrderStatusInput } from './order.schemas';
import { NotFoundError, BadRequestError } from '../../errors';
import { getPaginationParams, formatPaginatedResult, formatKoboToNaira } from '../../utils';
import { recordAuditLog } from '../../middlewares/audit';
import { saleService } from '../sales/sale.service';

export class OrderService {
  async createOrder(businessId: string, userId: string, input: CreateOrderInput) {
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestError('One or more selected products are invalid or belong to another business');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const settings = await prisma.businessSetting.findUnique({ where: { businessId } });
    const vatRateBps = settings?.vatRateBps ?? 750;

    let subtotalKobo = 0;
    const processedItems = input.items.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice = item.unitPriceKobo || Number(prod.sellingPrice);
      const total = unitPrice * item.quantity;
      subtotalKobo += total;

      return {
        productId: prod.id,
        quantity: item.quantity,
        unitPrice: BigInt(unitPrice),
        total: BigInt(total),
      };
    });

    const discountKobo = input.discountAmountKobo || 0;
    const discounted = Math.max(0, subtotalKobo - discountKobo);
    const taxKobo = input.applyVat ? Math.round((discounted * vatRateBps) / 10000) : 0;
    const totalKobo = discounted + taxKobo;

    const count = await prisma.order.count({ where: { businessId } });
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber,
        customerId: input.customerId || null,
        status: 'DRAFT',
        subtotal: BigInt(subtotalKobo),
        discountAmount: BigInt(discountKobo),
        taxAmount: BigInt(taxKobo),
        total: BigInt(totalKobo),
        notes: input.notes || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        items: { create: processedItems },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'ORDER_CREATED',
      entity: 'Order',
      entityId: order.id,
      details: { orderNumber, total: formatKoboToNaira(order.total) },
    });

    return this.formatOrderResponse(order);
  }

  async listOrders(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const status = query.status;
    const customerId = query.customerId;

    const where: any = { businessId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take,
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = orders.map((o) => this.formatOrderResponse(o));
    return formatPaginatedResult(formatted, total, page, limit);
  }

  async getOrderById(businessId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!order || order.businessId !== businessId) {
      throw new NotFoundError('Order not found');
    }

    return this.formatOrderResponse(order);
  }

  async updateOrderStatus(businessId: string, orderId: string, userId: string, input: UpdateOrderStatusInput) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.businessId !== businessId) throw new NotFoundError('Order not found');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: input.status },
      include: { items: true, customer: true },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'ORDER_STATUS_UPDATED',
      entity: 'Order',
      entityId: orderId,
      details: { status: input.status },
    });

    return this.formatOrderResponse(updated);
  }

  async convertOrderToSale(
    businessId: string,
    orderId: string,
    memberId: string,
    userId: string,
    payments: Array<{ method: any; amountKobo: number; reference?: string; receiptUrl?: string }>
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.businessId !== businessId) throw new NotFoundError('Order not found');
    if (order.status === 'COMPLETED') throw new BadRequestError('Order already fulfilled into a sale');

    const saleResult = await saleService.createSale(
      businessId,
      memberId,
      userId,
      {
        customerId: order.customerId || undefined,
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitSellingPriceKobo: Number(i.unitPrice),
          discountAmountKobo: 0,
        })),
        discountAmountKobo: Number(order.discountAmount),
        applyVat: Number(order.taxAmount) > 0,
        payments,
        notes: `Fulfilled from Order #${order.orderNumber}`,
      }
    );

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    return saleResult;
  }

  private formatOrderResponse(order: any) {
    return {
      ...order,
      subtotalKobo: Number(order.subtotal),
      discountAmountKobo: Number(order.discountAmount),
      taxAmountKobo: Number(order.taxAmount),
      totalKobo: Number(order.total),
      subtotalNaira: Number(order.subtotal) / 100,
      totalNaira: Number(order.total) / 100,
      items: order.items?.map((item: any) => ({
        ...item,
        unitPriceKobo: Number(item.unitPrice),
        totalKobo: Number(item.total),
      })),
    };
  }
}

export const orderService = new OrderService();
