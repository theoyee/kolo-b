import { FastifyInstance } from 'fastify';
import { expenseController } from './expense.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';

export async function expenseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.post('/', { preHandler: [requirePermission('expenses:manage')] }, expenseController.recordExpense.bind(expenseController));
  fastify.get('/', { preHandler: [requirePermission('expenses:read')] }, expenseController.listExpenses.bind(expenseController));
  fastify.get('/summary', { preHandler: [requirePermission('expenses:read')] }, expenseController.getExpenseSummary.bind(expenseController));
}
