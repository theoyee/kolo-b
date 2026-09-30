import { z } from 'zod';

export const memberRoleSchema = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT']);

export const addMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: memberRoleSchema,
  permissions: z.array(z.string()).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const updateMemberSchema = z.object({
  role: memberRoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
