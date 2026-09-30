export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT';

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  OWNER: ['*'],
  ADMIN: [
    'business:read',
    'business:update',
    'members:read',
    'members:manage',
    'products:read',
    'products:manage',
    'categories:manage',
    'inventory:read',
    'inventory:adjust',
    'customers:read',
    'customers:manage',
    'sales:read',
    'sales:create',
    'sales:void',
    'orders:read',
    'orders:manage',
    'payments:read',
    'payments:manage',
    'expenses:read',
    'expenses:manage',
    'reports:read',
    'settings:read',
    'settings:manage',
    'audit:read',
  ],
  MANAGER: [
    'business:read',
    'members:read',
    'products:read',
    'products:manage',
    'categories:manage',
    'inventory:read',
    'inventory:adjust',
    'customers:read',
    'customers:manage',
    'sales:read',
    'sales:create',
    'sales:void',
    'orders:read',
    'orders:manage',
    'payments:read',
    'payments:manage',
    'expenses:read',
    'expenses:manage',
    'reports:read',
    'settings:read',
  ],
  CASHIER: [
    'products:read',
    'customers:read',
    'customers:manage',
    'sales:read',
    'sales:create',
    'orders:read',
    'orders:manage',
    'payments:read',
    'inventory:read',
  ],
  ACCOUNTANT: [
    'business:read',
    'sales:read',
    'orders:read',
    'payments:read',
    'expenses:read',
    'expenses:manage',
    'reports:read',
    'inventory:read',
    'audit:read',
  ],
};

export interface JwtUserPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
}

export interface TenantContext {
  businessId: string;
  businessName?: string;
  memberId: string;
  role: Role;
  permissions: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantContext;
    idempotencyKey?: string;
  }
}
