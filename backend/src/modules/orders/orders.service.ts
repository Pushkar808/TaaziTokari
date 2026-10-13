import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { dateOnly, orderBusinessDate } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { toAddress } from '../addresses/address.mapper';
import { toSlot } from '../catalog/catalog.mapper';
import { CouponsService } from '../coupons/coupons.service';
import { FeedbackDto, PlaceOrderDto } from './dto/order.dto';
import { toOrder } from './order.mapper';

const Decimal = Prisma.Decimal;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly coupons: CouponsService
  ) {}

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toOrder);
  }

  /**
   * Places an order. Everything runs in one transaction: if any product is short on
   * stock, nothing is saved. Prices, delivery fee and totals are computed here.
   */
  place(userId: string, dto: PlaceOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUniqueOrThrow({ where: { id: userId } });
      const address = await tx.customerAddress.findFirst({
        where: { id: dto.addressId, userId },
        include: { zone: true },
      });
      if (!address) throw new BadRequestException('Delivery address not found.');
      if (!address.zone.isActive) throw new BadRequestException('We do not deliver to this area yet.');
      const slot = await tx.deliverySlot.findFirst({ where: { id: dto.slotId, isActive: true } });
      if (!slot) throw new BadRequestException('Delivery slot not available.');

      // Same product listed twice in the cart counts once, with the quantities added up.
      const quantities = new Map<string, Prisma.Decimal>();
      for (const item of dto.items) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? new Decimal(0)).add(item.quantity));
      }
      const products = await tx.product.findMany({ where: { id: { in: [...quantities.keys()] } } });
      const lines = [...quantities].map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId);
        if (!product || !product.isAvailable) throw new BadRequestException('A product in your cart is no longer available.');
        return { product, quantity, itemTotal: product.price.mul(quantity) };
      });

      const subtotal = lines.reduce((sum, l) => sum.add(l.itemTotal), new Decimal(0));
      const savingsTotal = lines.reduce(
        (sum, l) => sum.add(Decimal.max(l.product.mrp.sub(l.product.price), 0).mul(l.quantity)),
        new Decimal(0)
      );
      const deliveryFee = subtotal.gte(address.zone.minOrderFreeDelivery) ? new Decimal(0) : address.zone.deliveryFee;

      // The server decides the discount; the browser only sends the code.
      const applied = dto.couponCode?.trim() ? await this.coupons.evaluate(tx, userId, dto.couponCode, subtotal) : null;
      const discountTotal = applied?.discount ?? new Decimal(0);

      // After the zone cut-off the order counts as the next day's.
      const businessDate = orderBusinessDate(address.zone.cutoffTime);

      const created = await tx.order.create({
        data: {
          orderNumber: randomUUID(), // replaced below, once the database has assigned `seq`
          orderDate: dateOnly(businessDate),
          userId,
          customerName: profile.fullName,
          customerPhone: address.phone || profile.phone,
          deliveryAddress: toAddress(address) as Prisma.InputJsonObject,
          deliverySlot: toSlot(slot) as Prisma.InputJsonObject,
          subtotal,
          deliveryFee,
          savingsTotal,
          couponCode: applied?.coupon.code ?? null,
          discountTotal,
          grandTotal: subtotal.sub(discountTotal).add(deliveryFee),
          paymentMethod: dto.paymentMethod,
          deliveryNotes: dto.deliveryNotes || null,
          items: {
            create: lines.map(({ product, quantity, itemTotal }) => ({
              productId: product.id,
              nameEn: product.nameEn,
              nameHi: product.nameHi,
              unit: product.unit,
              price: product.price,
              mrp: product.mrp,
              quantity,
              itemTotal,
              imageUrl: product.imageUrl,
            })),
          },
        },
      });
      const orderNumber = `ORD-LKO-${businessDate.replace(/-/g, '')}-${String(created.seq).padStart(5, '0')}`;
      const order = await tx.order.update({ where: { id: created.id }, data: { orderNumber }, include: { items: true } });

      for (const { product, quantity } of lines) {
        // The stock check and the decrement are one statement, so two buyers cannot both win the last unit.
        const { count } = await tx.product.updateMany({
          where: { id: product.id, stockQty: { gte: quantity } },
          data: { stockQty: { decrement: quantity } },
        });
        if (count === 0) throw new BadRequestException(`Not enough stock of ${product.nameEn}.`);

        const { stockQty } = await tx.product.findUniqueOrThrow({ where: { id: product.id }, select: { stockQty: true } });
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            productName: product.nameEn,
            changeQty: quantity.neg(),
            balanceQtyAfter: stockQty,
            reason: 'ONLINE_ORDER',
            referenceId: orderNumber,
            notes: `Order ${orderNumber} by ${profile.fullName}`,
            recordedBy: 'Customer Online Store',
          },
        });
      }

      await this.audit.log(
        {
          action: 'ORDER_CREATED',
          entityType: 'orders',
          entityId: order.id,
          actor: `${profile.fullName} (customer)`,
          details: `Order ${orderNumber} placed for Rs ${order.grandTotal}${applied ? ` with coupon ${applied.coupon.code} (-Rs ${discountTotal})` : ''}`,
        },
        tx
      );
      return toOrder(order);
    });
  }

  async submitFeedback(userId: string, orderId: string, dto: FeedbackDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Feedback is available after delivery.');
    if (order.feedbackSubmitted) throw new BadRequestException('Feedback was already submitted for this order.');

    await this.prisma.$transaction([
      this.prisma.customerFeedback.create({
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId,
          customerName: order.customerName,
          rating: dto.rating,
          comment: dto.comment ?? '',
        },
      }),
      this.prisma.order.update({ where: { id: order.id }, data: { feedbackSubmitted: true } }),
    ]);
  }
}
