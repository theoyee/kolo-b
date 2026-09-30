import { z } from 'zod';

export const paymentSplitSchema = z.object({
  method: z.enum(['CASH', 'BANK_TRANSFER', 'POS_TERMINAL', 'PAYSTACK', 'FLUTTERWAVE']),
  amountKobo: z.number().int().positive('Payment amount must be a positive integer in kobo'),
  reference: z.string().optional(),
  receiptUrl: z.string().optional(),
});

export const saleItemInputSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  unitSellingPriceKobo: z.number().int().positive().optional(),
  discountAmountKobo: z.number().int().nonnegative().default(0),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemInputSchema).min(1, 'At least one item is required in a sale'),
  discountAmountKobo: z.number().int().nonnegative().default(0),
  applyVat: z.boolean().default(false),
  payments: z.array(paymentSplitSchema).min(1, 'At least one payment method is required'),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;
export type PaymentSplitInput = z.infer<typeof paymentSplitSchema>;
