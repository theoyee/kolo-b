import { z } from 'zod';

export const recordPaymentSchema = z.object({
  saleId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amountKobo: z.number().int().positive('Payment amount must be greater than zero in kobo'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'POS_TERMINAL', 'PAYSTACK', 'FLUTTERWAVE']),
  reference: z.string().optional(),
  receiptUrl: z.string().optional(),
  senderName: z.string().optional(),
  senderBank: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// Direct Bank Transfer Submission with Receipt
export const submitBankTransferSchema = z.object({
  saleId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amountKobo: z.number().int().positive('Transfer amount in kobo is required'),
  transferReference: z.string().min(4, 'Bank session ID or reference is required'),
  receiptUrl: z.string().min(5, 'Uploaded receipt URL or document proof is required'),
  senderName: z.string().min(2, 'Sender bank account name is required'),
  senderBank: z.string().min(2, 'Sender bank name is required'),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// Admin Receipt Verification
export const verifyTransferSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED']),
  adminNotes: z.string().optional(),
});

export const initializeOnlinePaymentSchema = z.object({
  saleId: z.string().uuid().optional(),
  amountKobo: z.number().int().positive(),
  gateway: z.enum(['PAYSTACK', 'FLUTTERWAVE']),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type SubmitBankTransferInput = z.infer<typeof submitBankTransferSchema>;
export type VerifyTransferInput = z.infer<typeof verifyTransferSchema>;
export type InitializeOnlinePaymentInput = z.infer<typeof initializeOnlinePaymentSchema>;
