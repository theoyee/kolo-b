import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../db/prisma';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';
import { getPaginationParams, formatPaginatedResult } from '../../utils';

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.get(
    '/',
    { preHandler: [requirePermission('audit:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, skip, take } = getPaginationParams(request.query);
      const action = (request.query as any)?.action;
      const entity = (request.query as any)?.entity;

      const where: any = { businessId: request.tenant!.businessId };
      if (action) where.action = action;
      if (entity) where.entity = entity;

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return reply.status(200).send({
        success: true,
        data: logs,
        meta: formatPaginatedResult(logs, total, page, limit).meta,
      });
    }
  );
}
