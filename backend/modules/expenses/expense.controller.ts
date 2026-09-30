import { FastifyRequest, FastifyReply } from 'fastify';
import { expenseService } from './expense.service';
import { recordExpenseSchema } from './expense.schemas';

export class ExpenseController {
  async recordExpense(request: FastifyRequest, reply: FastifyReply) {
    const input = recordExpenseSchema.parse(request.body);
    const result = await expenseService.recordExpense(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(201).send({
      success: true,
      message: 'Expense recorded successfully',
      data: result,
    });
  }

  async listExpenses(request: FastifyRequest, reply: FastifyReply) {
    const result = await expenseService.listExpenses(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  async getExpenseSummary(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = request.query as any;
    const result = await expenseService.getExpenseSummary(request.tenant!.businessId, startDate, endDate);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const expenseController = new ExpenseController();
