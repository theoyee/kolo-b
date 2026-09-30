import prisma from '../../db/prisma';
import { RecordExpenseInput } from './expense.schemas';
import { getPaginationParams, formatPaginatedResult, formatKoboToNaira } from '../../utils';
import { recordAuditLog } from '../../middlewares/audit';

export class ExpenseService {
  async recordExpense(businessId: string, userId: string, input: RecordExpenseInput) {
    const expense = await prisma.expense.create({
      data: {
        businessId,
        category: input.category,
        title: input.title,
        amount: BigInt(input.amountKobo),
        payee: input.payee || null,
        date: input.date ? new Date(input.date) : new Date(),
        recordedById: userId,
        notes: input.notes || null,
        receiptUrl: input.receiptUrl || null,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'EXPENSE_RECORDED',
      entity: 'Expense',
      entityId: expense.id,
      details: {
        title: expense.title,
        category: expense.category,
        amount: formatKoboToNaira(expense.amount),
      },
    });

    return {
      ...expense,
      amountKobo: Number(expense.amount),
      amountNaira: Number(expense.amount) / 100,
      formattedNaira: formatKoboToNaira(expense.amount),
    };
  }

  async listExpenses(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const category = query.category;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const where: any = { businessId };
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
      }),
    ]);

    const formatted = expenses.map((e) => ({
      ...e,
      amountKobo: Number(e.amount),
      amountNaira: Number(e.amount) / 100,
      formattedNaira: formatKoboToNaira(e.amount),
    }));

    return formatPaginatedResult(formatted, total, page, limit);
  }

  async getExpenseSummary(businessId: string, startDate?: string, endDate?: string) {
    const where: any = { businessId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const expenses = await prisma.expense.findMany({ where });

    let totalExpenseKobo = 0;
    const byCategory: Record<string, number> = {};

    for (const exp of expenses) {
      const amt = Number(exp.amount);
      totalExpenseKobo += amt;
      byCategory[exp.category] = (byCategory[exp.category] || 0) + amt;
    }

    return {
      totalExpenseKobo,
      totalExpenseNaira: totalExpenseKobo / 100,
      formattedTotalNaira: formatKoboToNaira(totalExpenseKobo),
      count: expenses.length,
      byCategory: Object.entries(byCategory).map(([category, amountKobo]) => ({
        category,
        amountKobo,
        amountNaira: amountKobo / 100,
        formattedNaira: formatKoboToNaira(amountKobo),
      })),
    };
  }
}

export const expenseService = new ExpenseService();
