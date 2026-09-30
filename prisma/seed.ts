import { PrismaClient, Role, PaymentMethod, ExpenseCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Kolo SME database seed...');

  const passwordHash = await bcrypt.hash('KoloSME#2026', 10);

  // 1. Create Users
  const ownerUser = await prisma.user.upsert({
    where: { email: 'chinedu@mamachinedu.ng' },
    update: {},
    create: {
      email: 'chinedu@mamachinedu.ng',
      passwordHash,
      firstName: 'Chinedu',
      lastName: 'Okeke',
      phone: '08035551234',
      isSuperAdmin: false,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'adeola@mamachinedu.ng' },
    update: {},
    create: {
      email: 'adeola@mamachinedu.ng',
      passwordHash,
      firstName: 'Adeola',
      lastName: 'Balogun',
      phone: '08024445678',
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { email: 'fatima@mamachinedu.ng' },
    update: {},
    create: {
      email: 'fatima@mamachinedu.ng',
      passwordHash,
      firstName: 'Fatima',
      lastName: 'Garba',
      phone: '08183339012',
    },
  });

  console.log('✅ Created users: Owner, Manager, Cashier');

  // 2. Create Business & Settings with Bank Transfer Account
  const business = await prisma.business.upsert({
    where: { slug: 'mama-chinedu-supermarket-lagos' },
    update: {},
    create: {
      name: 'Mama Chinedu Supermarket & Provisions',
      slug: 'mama-chinedu-supermarket-lagos',
      legalName: 'Mama Chinedu Retail Enterprises Ltd',
      rcNumber: 'RC-1849204',
      address: '14 Allen Avenue, Ikeja',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'NG',
      currency: 'NGN',
      phone: '08035551234',
      email: 'info@mamachinedu.ng',
    },
  });

  await prisma.businessSetting.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      allowNegativeStock: false,
      vatRateBps: 750,
      currencySymbol: '₦',
      invoicePrefix: 'MAMA-',
      receiptNotes: 'Thank you for your patronage! Goods sold in good condition are not returnable.',
      lowStockThresholdDefault: 10,
      // Official Nigerian Bank Account for Transfers
      bankName: 'Moniepoint Microfinance Bank',
      bankAccountNumber: '8239019201',
      bankAccountName: 'Mama Chinedu Supermarket & Provisions',
      bankTransferInstructions: 'Transfer exact amount to our Moniepoint account and upload payment receipt for admin approval.',
    },
  });

  // 3. Assign Memberships
  await prisma.member.upsert({
    where: { userId_businessId: { userId: ownerUser.id, businessId: business.id } },
    update: {},
    create: {
      userId: ownerUser.id,
      businessId: business.id,
      role: Role.OWNER,
      permissions: ['*'],
    },
  });

  await prisma.member.upsert({
    where: { userId_businessId: { userId: managerUser.id, businessId: business.id } },
    update: {},
    create: {
      userId: managerUser.id,
      businessId: business.id,
      role: Role.MANAGER,
      permissions: [],
    },
  });

  const cashierMember = await prisma.member.upsert({
    where: { userId_businessId: { userId: cashierUser.id, businessId: business.id } },
    update: {},
    create: {
      userId: cashierUser.id,
      businessId: business.id,
      role: Role.CASHIER,
      permissions: [],
    },
  });

  // 4. Products & Categories
  const catGroceries = await prisma.category.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Food & Groceries' } },
    update: {},
    create: { businessId: business.id, name: 'Food & Groceries' },
  });

  const prod1 = await prisma.product.upsert({
    where: { businessId_sku: { businessId: business.id, sku: 'SEM-GP-2KG' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'Golden Penny Semovita 2kg',
      sku: 'SEM-GP-2KG',
      categoryId: catGroceries.id,
      costPrice: BigInt(180000), // ₦1,800
      sellingPrice: BigInt(220000), // ₦2,200
      currentStock: 85,
      minStockAlert: 15,
    },
  });

  // 5. Customer
  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      fullName: 'Alhaji Ibrahim Danjuma',
      phone: '08031234567',
      email: 'ibrahim.d@example.com',
      totalPurchases: BigInt(25000000),
      currentBalance: BigInt(0),
    },
  });

  // 6. Direct Bank Transfer Payment Awaiting Admin Verification (Sample)
  await prisma.payment.create({
    data: {
      businessId: business.id,
      amount: BigInt(440000), // ₦4,400
      method: PaymentMethod.BANK_TRANSFER,
      reference: 'TRANSFER-GTB-992104812',
      status: 'PENDING', // Awaiting admin verification
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
      senderName: 'Alhaji Ibrahim Danjuma',
      senderBank: 'Guaranty Trust Bank (GTBank)',
      adminNotes: 'Customer sent receipt via WhatsApp. Pending verification against bank app.',
    },
  });

  console.log('✅ Seeded direct bank transfer pending verification');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
