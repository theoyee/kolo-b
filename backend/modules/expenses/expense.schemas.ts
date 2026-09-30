import { z } from 'zod';

export const expenseCategorySchema = z.enum([
  'RENT',
  'DIESEL_GENERATOR',
  'SALARIES',
  'UTILITIES',
  'MAINTENANCE',
  'SUPPLIES',
  'MARKETING',
  'LOGISTICS',
  'OTHER',
]);

export const recordExpenseSchema = z.object({
  category: expenseCategorySchema,
  title: z.string().min(2, 'Expense title is required'),
  amountKobo: z.number().int().positive('Expense amount must be positive in kobo'),
  payee: z.string().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
  receiptUrl: z.string().url().optional(),
});

export type RecordExpenseInput = z.infer<typeof recordExpenseSchema>;
