import prisma from '../../db/prisma';
import { CreateBusinessInput, UpdateBusinessInput } from './business.schemas';
import { NotFoundError } from '../../errors';
import { recordAuditLog } from '../../middlewares/audit';

export class BusinessService {
  async createBusiness(userId: string, input: CreateBusinessInput) {
    const slug =
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50) + '-' + Math.floor(1000 + Math.random() * 9000);

    const business = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          name: input.name,
          slug,
          legalName: input.legalName || null,
          rcNumber: input.rcNumber || null,
          address: input.address || null,
          city: input.city || null,
          state: input.state || 'Lagos',
          phone: input.phone || null,
          email: input.email || null,
          currency: input.currency || 'NGN',
        },
      });

      await tx.businessSetting.create({
        data: {
          businessId: biz.id,
          allowNegativeStock: false,
          vatRateBps: 750,
          currencySymbol: '₦',
          invoicePrefix: 'KOLO-',
          bankName: 'Moniepoint Microfinance Bank',
          bankAccountNumber: '8239019201',
          bankAccountName: input.name,
          receiptNotes: 'Thank you for your patronage! Goods sold in good condition are not returnable.',
        },
      });

      await tx.member.create({
        data: {
          userId,
          businessId: biz.id,
          role: 'OWNER',
          permissions: ['*'],
        },
      });

      return biz;
    });

    await recordAuditLog({
      businessId: business.id,
      userId,
      action: 'BUSINESS_CREATED',
      entity: 'Business',
      entityId: business.id,
      details: { name: business.name },
    });

    return business;
  }

  async getUserBusinesses(userId: string) {
    const memberships = await prisma.member.findMany({
      where: { userId, isActive: true },
      include: {
        business: {
          include: {
            settings: true,
            _count: { select: { members: true, products: true, sales: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.business,
      membership: { id: m.id, role: m.role, permissions: m.permissions },
    }));
  }

  async getBusinessById(businessId: string, userId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        settings: true,
        _count: { select: { members: true, products: true, customers: true, sales: true } },
      },
    });

    if (!business) throw new NotFoundError('Business not found');
    return business;
  }

  async updateBusiness(businessId: string, userId: string, input: UpdateBusinessInput) {
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        name: input.name,
        legalName: input.legalName,
        rcNumber: input.rcNumber,
        address: input.address,
        city: input.city,
        state: input.state,
        phone: input.phone,
        email: input.email,
        currency: input.currency,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'BUSINESS_UPDATED',
      entity: 'Business',
      entityId: businessId,
      details: input,
    });

    return updated;
  }
}

export const businessService = new BusinessService();
