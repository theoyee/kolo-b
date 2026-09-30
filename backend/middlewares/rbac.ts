import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { Role } from '../types';

export function requireRole(allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (request.user.isSuperAdmin) return;

    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenError('Tenant context required for role verification');
    }
    if (tenant.role === 'OWNER') return;

    if (!allowedRoles.includes(tenant.role)) {
      throw new ForbiddenError(`Access denied. Required role: [${allowedRoles.join(', ')}]. Current role: ${tenant.role}`);
    }
  };
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (request.user.isSuperAdmin) return;

    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenError('Tenant context required for permission verification');
    }
    if (tenant.role === 'OWNER' || tenant.permissions.includes('*')) return;

    if (!tenant.permissions.includes(permission)) {
      throw new ForbiddenError(`Access denied. Required permission: "${permission}"`);
    }
  };
}
