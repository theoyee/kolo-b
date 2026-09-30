import { z } from 'zod';

export const updateSettingsSchema = z.object({
  allowNegativeStock: z.boolean().optional(),
  vatRateBps: z.number().int().min(0).max(5000).optional(),
  currencySymbol: z.string().optional(),
  receiptNotes: z.string().optional(),
  invoicePrefix: z.string().optional(),
  lowStockThresholdDefault: z.number().int().min(0).optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankTransferInstructions: z.string().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
