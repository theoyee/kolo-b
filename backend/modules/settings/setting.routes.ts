import { FastifyInstance } from 'fastify';
import { settingController } from './setting.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission, requireRole } from '../../middlewares/rbac';

export async function settingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.get('/', { preHandler: [requirePermission('settings:read')] }, settingController.getSettings.bind(settingController));
  fastify.patch('/', { preHandler: [requireRole(['OWNER', 'ADMIN'])] }, settingController.updateSettings.bind(settingController));
}
