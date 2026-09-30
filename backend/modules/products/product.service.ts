import prisma from '../../db/prisma';
import { CreateProductInput, UpdateProductInput, CreateCategoryInput } from './product.schemas';
import { NotFoundError, ConflictError } from '../../errors';
import { getPaginationParams, formatPaginatedResult } from '../../utils';
import { recordAuditLog } from '../../middlewares/audit';

export class ProductService {
  async listProducts(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();
    const categoryId = query.categoryId;

    const where: any = { businessId, isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
      }),
    ]);

    const formatted = products.map((p) => ({
      ...p,
      costPriceKobo: Number(p.costPrice),
      sellingPriceKobo: Number(p.sellingPrice),
      costPriceNaira: Number(p.costPrice) / 100,
      sellingPriceNaira: Number(p.sellingPrice) / 100,
      isLowStock: p.currentStock <= p.minStockAlert,
    }));

    return formatPaginatedResult(formatted, total, page, limit);
  }

  async getProductById(businessId: string, productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        inventoryMovements: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!product || product.businessId !== businessId) {
      throw new NotFoundError('Product not found');
    }

    return {
      ...product,
      costPriceKobo: Number(product.costPrice),
      sellingPriceKobo: Number(product.sellingPrice),
      costPriceNaira: Number(product.costPrice) / 100,
      sellingPriceNaira: Number(product.sellingPrice) / 100,
      isLowStock: product.currentStock <= product.minStockAlert,
    };
  }

  async createProduct(businessId: string, userId: string, input: CreateProductInput) {
    const existing = await prisma.product.findUnique({
      where: {
        businessId_sku: {
          businessId,
          sku: input.sku.toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictError(`A product with SKU "${input.sku}" already exists`);
    }

    const product = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          businessId,
          name: input.name,
          sku: input.sku.toUpperCase(),
          barcode: input.barcode || null,
          description: input.description || null,
          categoryId: input.categoryId || null,
          unit: input.unit || 'PCS',
          costPrice: BigInt(input.costPriceKobo),
          sellingPrice: BigInt(input.sellingPriceKobo),
          currentStock: input.initialStock || 0,
          minStockAlert: input.minStockAlert,
        },
      });

      if (input.initialStock && input.initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: prod.id,
            type: 'RESTOCK',
            quantity: input.initialStock,
            previousStock: 0,
            newStock: input.initialStock,
            reason: 'Initial stock intake',
            createdByUserId: userId,
          },
        });
      }

      return prod;
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      details: { name: product.name, sku: product.sku },
    });

    return {
      ...product,
      costPriceKobo: Number(product.costPrice),
      sellingPriceKobo: Number(product.sellingPrice),
    };
  }

  async updateProduct(businessId: string, productId: string, userId: string, input: UpdateProductInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== businessId) throw new NotFoundError('Product not found');

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        name: input.name,
        barcode: input.barcode,
        description: input.description,
        categoryId: input.categoryId,
        unit: input.unit,
        costPrice: input.costPriceKobo !== undefined ? BigInt(input.costPriceKobo) : undefined,
        sellingPrice: input.sellingPriceKobo !== undefined ? BigInt(input.sellingPriceKobo) : undefined,
        minStockAlert: input.minStockAlert,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: productId,
      details: input,
    });

    return {
      ...updated,
      costPriceKobo: Number(updated.costPrice),
      sellingPriceKobo: Number(updated.sellingPrice),
    };
  }

  async deleteProduct(businessId: string, productId: string, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== businessId) throw new NotFoundError('Product not found');

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'PRODUCT_DELETED',
      entity: 'Product',
      entityId: productId,
    });

    return { success: true, message: 'Product archived successfully' };
  }

  async listCategories(businessId: string) {
    return prisma.category.findMany({
      where: { businessId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(businessId: string, userId: string, input: CreateCategoryInput) {
    const existing = await prisma.category.findUnique({
      where: { businessId_name: { businessId, name: input.name } },
    });

    if (existing) throw new ConflictError('A category with this name already exists');

    const category = await prisma.category.create({
      data: {
        businessId,
        name: input.name,
        description: input.description || null,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'CATEGORY_CREATED',
      entity: 'Category',
      entityId: category.id,
      details: { name: category.name },
    });

    return category;
  }
}

export const productService = new ProductService();
