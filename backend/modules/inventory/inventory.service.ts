import prisma from '../../db/prisma';
import { AdjustStockInput } from './inventory.schemas';
import { NotFoundError, InsufficientStockError } from '../../errors';
import { getPaginationParams, formatPaginatedResult } from '../../utils';
import { notificationQueue } from '../../queue/bullmq';
import { recordAuditLog } from '../../middlewares/audit';

export class InventoryService {
  async adjustStock(businessId: string, userId: string, input: AdjustStockInput) {
    const [product, settings] = await Promise.all([
      prisma.product.findUnique({ where: { id: input.productId } }),
      prisma.businessSetting.findUnique({ where: { businessId } }),
    ]);

    if (!product || product.businessId !== businessId) {
      throw new NotFoundError('Product not found');
    }

    const previousStock = product.currentStock;
    const newStock = previousStock + input.quantity;

    const allowNegative = settings?.allowNegativeStock ?? false;
    if (newStock < 0 && !allowNegative) {
      throw new InsufficientStockError(
        `Adjustment would cause negative stock (${newStock}) for "${product.name}". Business policy prohibits negative inventory.`,
        { productId: product.id, currentStock: previousStock, requestedAdjustment: input.quantity }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: input.productId },
        data: { currentStock: newStock },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          businessId,
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          previousStock,
          newStock,
          reason: input.reason,
          createdByUserId: userId,
        },
      });

      return { product: updatedProduct, movement };
    });

    if (newStock <= product.minStockAlert) {
      await notificationQueue.add('check_low_stock_alert', {
        businessId,
        productId: product.id,
        productName: product.name,
        currentStock: newStock,
        threshold: product.minStockAlert,
      });
    }

    await recordAuditLog({
      businessId,
      userId,
      action: 'STOCK_ADJUSTED',
      entity: 'InventoryMovement',
      entityId: result.movement.id,
      details: {
        productName: product.name,
        type: input.type,
        delta: input.quantity,
        previousStock,
        newStock,
      },
    });

    return result;
  }

  async getMovements(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const productId = query.productId;
    const type = query.type;

    const where: any = { businessId };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return formatPaginatedResult(movements, total, page, limit);
  }

  async getLowStockAlerts(businessId: string) {
    const products = await prisma.product.findMany({
      where: { businessId, isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { currentStock: 'asc' },
    });

    const lowStock = products.filter((p) => p.currentStock <= p.minStockAlert);
    return lowStock.map((p) => ({
      ...p,
      costPriceKobo: Number(p.costPrice),
      sellingPriceKobo: Number(p.sellingPrice),
      deficit: p.minStockAlert - p.currentStock,
    }));
  }
}

export const inventoryService = new InventoryService();
