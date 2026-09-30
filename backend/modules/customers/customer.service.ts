import prisma from '../../db/prisma';
import { CreateCustomerInput, UpdateCustomerInput } from './customer.schemas';
import { NotFoundError } from '../../errors';
import { getPaginationParams, formatPaginatedResult } from '../../utils';
import { recordAuditLog } from '../../middlewares/audit';

export class CustomerService {
  async listCustomers(businessId: string, query: any) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const search = query.search?.trim();
    const hasDebt = query.hasDebt === 'true';

    const where: any = { businessId };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (hasDebt) {
      where.currentBalance = { gt: BigInt(0) };
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
      }),
    ]);

    const formatted = customers.map((c) => ({
      ...c,
      totalPurchasesKobo: Number(c.totalPurchases),
      currentBalanceKobo: Number(c.currentBalance),
      totalPurchasesNaira: Number(c.totalPurchases) / 100,
      currentBalanceNaira: Number(c.currentBalance) / 100,
    }));

    return formatPaginatedResult(formatted, total, page, limit);
  }

  async getCustomerById(businessId: string, customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer || customer.businessId !== businessId) {
      throw new NotFoundError('Customer not found');
    }

    return {
      ...customer,
      totalPurchasesKobo: Number(customer.totalPurchases),
      currentBalanceKobo: Number(customer.currentBalance),
      sales: customer.sales.map((s) => ({
        ...s,
        subtotal: Number(s.subtotal),
        grandTotal: Number(s.grandTotal),
        amountPaid: Number(s.amountPaid),
      })),
    };
  }

  async createCustomer(businessId: string, userId: string, input: CreateCustomerInput) {
    const customer = await prisma.customer.create({
      data: {
        businessId,
        fullName: input.fullName,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        currentBalance: BigInt(input.initialBalanceKobo || 0),
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'CUSTOMER_CREATED',
      entity: 'Customer',
      entityId: customer.id,
      details: { fullName: customer.fullName, phone: customer.phone },
    });

    return {
      ...customer,
      totalPurchasesKobo: Number(customer.totalPurchases),
      currentBalanceKobo: Number(customer.currentBalance),
    };
  }

  async updateCustomer(businessId: string, customerId: string, userId: string, input: UpdateCustomerInput) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.businessId !== businessId) throw new NotFoundError('Customer not found');

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        address: input.address,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'CUSTOMER_UPDATED',
      entity: 'Customer',
      entityId: customerId,
      details: input,
    });

    return {
      ...updated,
      totalPurchasesKobo: Number(updated.totalPurchases),
      currentBalanceKobo: Number(updated.currentBalance),
    };
  }
}

export const customerService = new CustomerService();
