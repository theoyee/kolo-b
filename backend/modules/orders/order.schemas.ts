import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPriceKobo: z.number().int().positive().optional(),
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  discountAmountKobo: z.number().int().default(0),
  applyVat: z.boolean().default(false),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
