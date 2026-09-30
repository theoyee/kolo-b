import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().default('PCS'),
  costPriceKobo: z.number().int().nonnegative('Cost price must be non-negative integer in kobo'),
  sellingPriceKobo: z.number().int().positive('Selling price must be greater than zero in kobo'),
  initialStock: z.number().int().nonnegative().default(0),
  minStockAlert: z.number().int().nonnegative().default(10),
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
