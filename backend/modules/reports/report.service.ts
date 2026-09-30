import prisma from '../../db/prisma';
import { formatKoboToNaira } from '../../utils';

export class ReportService {
  async getDailySummary(businessId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const [sales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        include: { items: true },
      }),
      prisma.payment.findMany({
        where: {
          businessId,
          status: 'SUCCESS',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    let totalRevenueKobo = 0;
    let totalDiscountKobo = 0;
    let totalTaxKobo = 0;
    let totalItemsSold = 0;

    for (const s of sales) {
      totalRevenueKobo += Number(s.grandTotal);
      totalDiscountKobo += Number(s.discountAmount);
      totalTaxKobo += Number(s.taxAmount);
      for (const item of s.items) totalItemsSold += item.quantity;
    }

    const byPaymentMethod: Record<string, number> = {
      CASH: 0,
      BANK_TRANSFER: 0,
      POS_TERMINAL: 0,
      PAYSTACK: 0,
      FLUTTERWAVE: 0,
    };

    for (const p of payments) {
      byPaymentMethod[p.method] = (byPaymentMethod[p.method] || 0) + Number(p.amount);
    }

    const averageBasketKobo = sales.length > 0 ? Math.round(totalRevenueKobo / sales.length) : 0;

    return {
      date: startOfDay.toISOString().slice(0, 10),
      totalSalesCount: sales.length,
      totalItemsSold,
      totalRevenueKobo,
      totalRevenueNaira: totalRevenueKobo / 100,
      formattedRevenue: formatKoboToNaira(totalRevenueKobo),
      totalDiscountKobo,
      totalTaxKobo,
      averageBasketKobo,
      formattedAverageBasket: formatKoboToNaira(averageBasketKobo),
      paymentMethodBreakdown: Object.entries(byPaymentMethod).map(([method, amountKobo]) => ({
        method,
        amountKobo,
        amountNaira: amountKobo / 100,
        formattedNaira: formatKoboToNaira(amountKobo),
      })),
    };
  }

  async getProfitLoss(businessId: string, startDate?: string, endDate?: string) {
    const whereSale: any = { businessId, status: 'COMPLETED' };
    const whereExpense: any = { businessId };

    if (startDate || endDate) {
      whereSale.createdAt = {};
      whereExpense.date = {};
      if (startDate) {
        whereSale.createdAt.gte = new Date(startDate);
        whereExpense.date.gte = new Date(startDate);
      }
      if (endDate) {
        whereSale.createdAt.lte = new Date(endDate);
        whereExpense.date.lte = new Date(endDate);
      }
    }

    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({ where: whereSale, include: { items: true } }),
      prisma.expense.findMany({ where: whereExpense }),
    ]);

    let totalRevenueKobo = 0;
    let costOfGoodsSoldKobo = 0;

    for (const s of sales) {
      totalRevenueKobo += Number(s.grandTotal);
      for (const item of s.items) {
        costOfGoodsSoldKobo += Number(item.unitCostPrice) * item.quantity;
      }
    }

    const grossProfitKobo = totalRevenueKobo - costOfGoodsSoldKobo;

    let operatingExpensesKobo = 0;
    for (const exp of expenses) {
      operatingExpensesKobo += Number(exp.amount);
    }

    const netProfitKobo = grossProfitKobo - operatingExpensesKobo;
    const grossMarginPercent =
      totalRevenueKobo > 0 ? Number(((grossProfitKobo / totalRevenueKobo) * 100).toFixed(2)) : 0;

    return {
      period: { startDate: startDate || 'All time', endDate: endDate || 'Now' },
      revenueKobo: totalRevenueKobo,
      revenueNaira: totalRevenueKobo / 100,
      formattedRevenue: formatKoboToNaira(totalRevenueKobo),
      cogsKobo: costOfGoodsSoldKobo,
      cogsNaira: costOfGoodsSoldKobo / 100,
      formattedCogs: formatKoboToNaira(costOfGoodsSoldKobo),
      grossProfitKobo,
      grossProfitNaira: grossProfitKobo / 100,
      formattedGrossProfit: formatKoboToNaira(grossProfitKobo),
      grossMarginPercent,
      operatingExpensesKobo,
      operatingExpensesNaira: operatingExpensesKobo / 100,
      formattedOperatingExpenses: formatKoboToNaira(operatingExpensesKobo),
      netProfitKobo,
      netProfitNaira: netProfitKobo / 100,
      formattedNetProfit: formatKoboToNaira(netProfitKobo),
    };
  }

  async getTopSellingProducts(businessId: string, limit = 10) {
    const saleItems = await prisma.saleItem.findMany({
      where: { sale: { businessId, status: 'COMPLETED' } },
      include: {
        product: { select: { id: true, name: true, sku: true, currentStock: true } },
      },
    });

    const aggregated = new Map<string, { product: any; totalQuantity: number; totalRevenueKobo: number }>();

    for (const item of saleItems) {
      const existing = aggregated.get(item.productId) || {
        product: item.product,
        totalQuantity: 0,
        totalRevenueKobo: 0,
      };
      existing.totalQuantity += item.quantity;
      existing.totalRevenueKobo += Number(item.total);
      aggregated.set(item.productId, existing);
    }

    return Array.from(aggregated.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        totalRevenueNaira: item.totalRevenueKobo / 100,
        formattedRevenue: formatKoboToNaira(item.totalRevenueKobo),
      }));
  }

  async getInventoryValuation(businessId: string) {
    const products = await prisma.product.findMany({ where: { businessId, isActive: true } });

    let totalStockUnits = 0;
    let totalCostValuationKobo = 0;
    let totalRetailValuationKobo = 0;

    for (const p of products) {
      const stock = Math.max(0, p.currentStock);
      totalStockUnits += stock;
      totalCostValuationKobo += Number(p.costPrice) * stock;
      totalRetailValuationKobo += Number(p.sellingPrice) * stock;
    }

    const potentialGrossProfitKobo = totalRetailValuationKobo - totalCostValuationKobo;

    return {
      totalProductsCount: products.length,
      totalStockUnits,
      totalCostValuationKobo,
      totalCostValuationNaira: totalCostValuationKobo / 100,
      formattedCostValuation: formatKoboToNaira(totalCostValuationKobo),
      totalRetailValuationKobo,
      totalRetailValuationNaira: totalRetailValuationKobo / 100,
      formattedRetailValuation: formatKoboToNaira(totalRetailValuationKobo),
      potentialGrossProfitKobo,
      potentialGrossProfitNaira: potentialGrossProfitKobo / 100,
      formattedPotentialGrossProfit: formatKoboToNaira(potentialGrossProfitKobo),
    };
  }
}

export const reportService = new ReportService();
