import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { dateOnly } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { toOrder } from '../orders/order.mapper';
import { toManualSale, toPurchase } from './admin.mapper';
import { ManualSaleDto, PurchaseDto } from './dto/admin.dto';

const Decimal = Prisma.Decimal;

/** Admin actions that move stock. Each one writes the product, the record, the stock ledger and the audit log together. */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Records a mandi purchase: adds stock and updates the weighted-average cost. */
  recordPurchase(adminId: string, dto: PurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found.');
      const actor = await this.audit.actorName(adminId, tx);

      const quantity = new Decimal(dto.quantity);
      const unitCost = new Decimal(dto.totalCost).div(quantity).toDecimalPlaces(2);
      // Products that never had a cost recorded are valued at 70% of their price.
      const currentCost = product.weightedCost.isZero() ? product.price.mul(0.7) : product.weightedCost;
      const newStock = product.stockQty.add(quantity);
      const weightedCost = product.stockQty.mul(currentCost).add(quantity.mul(unitCost)).div(newStock).toDecimalPlaces(2);

      await tx.product.update({ where: { id: product.id }, data: { stockQty: newStock, weightedCost } });
      const purchase = await tx.purchase.create({
        data: {
          date: dateOnly(dto.date),
          productId: product.id,
          productName: product.nameEn,
          quantity,
          unit: product.unit,
          totalCost: dto.totalCost,
          unitCost,
          supplierName: dto.supplierName || null,
          notes: dto.notes || null,
          recordedBy: actor,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          productName: product.nameEn,
          changeQty: quantity,
          balanceQtyAfter: newStock,
          reason: 'PURCHASE',
          referenceId: purchase.id,
          notes: `Purchase from ${dto.supplierName || 'Mandi'} @ Rs ${unitCost}`,
          recordedBy: actor,
        },
      });
      await this.audit.log(
        {
          action: 'RECORD_PURCHASE',
          entityType: 'purchases',
          entityId: purchase.id,
          actor,
          details: `${dto.quantity} x ${product.nameEn} for Rs ${dto.totalCost}`,
        },
        tx
      );
      return toPurchase(purchase);
    });
  }

  /** Records a counter (walk-in) sale: removes stock. */
  recordManualSale(adminId: string, dto: ManualSaleDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found.');
      const actor = await this.audit.actorName(adminId, tx);

      const { count } = await tx.product.updateMany({
        where: { id: product.id, stockQty: { gte: dto.quantity } },
        data: { stockQty: { decrement: dto.quantity } },
      });
      if (count === 0) throw new BadRequestException(`Only ${product.stockQty} of ${product.nameEn} in stock.`);
      const { stockQty } = await tx.product.findUniqueOrThrow({ where: { id: product.id }, select: { stockQty: true } });

      const sale = await tx.manualSale.create({
        data: {
          date: dateOnly(dto.date),
          productId: product.id,
          productName: product.nameEn,
          quantity: dto.quantity,
          unit: product.unit,
          sellingPrice: dto.sellingPrice,
          totalRevenue: new Decimal(dto.quantity).mul(dto.sellingPrice).toDecimalPlaces(2),
          notes: dto.notes || null,
          recordedBy: actor,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          productName: product.nameEn,
          changeQty: new Decimal(dto.quantity).neg(),
          balanceQtyAfter: stockQty,
          reason: 'MANUAL_SALE',
          referenceId: sale.id,
          notes: `Counter sale @ Rs ${dto.sellingPrice}`,
          recordedBy: actor,
        },
      });
      await this.audit.log(
        { action: 'RECORD_MANUAL_SALE', entityType: 'manual_sales', entityId: sale.id, actor, details: `${dto.quantity} x ${product.nameEn}` },
        tx
      );
      return toManualSale(sale);
    });
  }

  /** Moves an order to a new status. Cancelling puts the stock back. */
  updateOrderStatus(adminId: string, orderId: string, status: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found.');
      // Reopening a cancelled order would let it be cancelled (and restocked) a second time.
      if (order.status === 'CANCELLED' && status !== 'CANCELLED') {
        throw new BadRequestException('A cancelled order cannot be reopened.');
      }
      const actor = await this.audit.actorName(adminId, tx);

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        for (const item of order.items) {
          const { count } = await tx.product.updateMany({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
          if (count === 0) continue; // product was deleted since the order
          const { stockQty } = await tx.product.findUniqueOrThrow({ where: { id: item.productId }, select: { stockQty: true } });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              productName: item.nameEn,
              changeQty: item.quantity,
              balanceQtyAfter: stockQty,
              reason: 'ADJUSTMENT',
              referenceId: order.orderNumber,
              notes: `Order ${order.orderNumber} cancelled. Restocked.`,
              recordedBy: actor,
            },
          });
        }
      }

      const updated = await tx.order.update({ where: { id: order.id }, data: { status }, include: { items: true } });
      await this.audit.log(
        {
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'orders',
          entityId: order.id,
          actor,
          details: `${order.orderNumber}: ${order.status} -> ${status}`,
        },
        tx
      );
      return toOrder(updated);
    });
  }
}
