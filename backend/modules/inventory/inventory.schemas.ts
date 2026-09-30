import { z } from 'zod';

export const movementTypeSchema = z.enum([
  'RESTOCK',
  'SALE_DEDUCTION',
  'DAMAGE',
  'LOSS',
  'RETURN',
  'ADJUSTMENT',
]);

export const adjustStockSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  type: movementTypeSchema,
  quantity: z.number().int().refine((q) => q !== 0, 'Quantity delta cannot be zero'),
  reason: z.string().min(2, 'Reason for inventory adjustment is required'),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
