import { Injectable } from '@nestjs/common';
import { dateOnly, istDate } from '../../common/dates';
import { num, round2 } from '../../common/numbers';
import { PrismaService } from '../../prisma/prisma.service';

// Products with no recorded purchase cost are valued at 70% of their selling price.
const FALLBACK_COST_RATIO = 0.7;

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The dashboard numbers for one IST day (defaults to today). */
  async forDay(date: string = istDate()) {
    const day = dateOnly(date);
    const placedToday = { orderDate: day, status: { not: 'CANCELLED' as const } };

    const [online, manual, purchases, expenses, onlineItems, manualSales, products] = await Promise.all([
      this.prisma.order.aggregate({ where: placedToday, _sum: { subtotal: true }, _count: true }),
      this.prisma.manualSale.aggregate({ where: { date: day }, _sum: { totalRevenue: true } }),
      this.prisma.purchase.aggregate({ where: { date: day }, _sum: { totalCost: true } }),
      this.prisma.expense.aggregate({ where: { date: day }, _sum: { amount: true } }),
      this.prisma.orderItem.findMany({ where: { order: placedToday }, select: { productId: true, price: true, quantity: true } }),
      this.prisma.manualSale.findMany({ where: { date: day }, select: { productId: true, sellingPrice: true, quantity: true } }),
      this.prisma.product.findMany(),
    ]);

    const costOf = new Map(products.map((p) => [p.id, num(p.weightedCost)]));
    const unitCost = (productId: string, sellingPrice: number) =>
      costOf.get(productId) || sellingPrice * FALLBACK_COST_RATIO;

    const cogs =
      onlineItems.reduce((sum, i) => sum + num(i.quantity) * unitCost(i.productId, num(i.price)), 0) +
      manualSales.reduce((sum, s) => sum + num(s.quantity) * unitCost(s.productId, num(s.sellingPrice)), 0);
    const inventoryValue = products.reduce(
      (sum, p) => sum + num(p.stockQty) * (num(p.weightedCost) || num(p.price) * FALLBACK_COST_RATIO),
      0
    );

    const onlineRevenue = num(online._sum.subtotal);
    const manualRevenue = num(manual._sum.totalRevenue);
    const operatingExpenses = num(expenses._sum.amount);
    const grossProfit = round2(onlineRevenue + manualRevenue - cogs);

    return {
      targetDate: date,
      totalSalesRevenue: onlineRevenue + manualRevenue,
      onlineSalesRevenue: onlineRevenue,
      manualSalesRevenue: manualRevenue,
      totalPurchaseSpending: num(purchases._sum.totalCost),
      totalOperatingExpenses: operatingExpenses,
      cogs: round2(cogs),
      estimatedGrossProfit: grossProfit,
      estimatedNetOperatingProfit: round2(grossProfit - operatingExpenses),
      totalInventoryValue: round2(inventoryValue),
      lowStockCount: products.filter((p) => p.stockQty.lte(p.lowStockThreshold)).length,
      orderCount: online._count,
    };
  }
}
