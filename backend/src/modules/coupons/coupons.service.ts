import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateDiscount } from './coupon-discount';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks every rule for this customer and subtotal and works out the discount.
   * Pass a transaction client so placing an order checks and saves in one transaction.
   * Cancelled orders do not count as a use.
   */
  async evaluate(db: Db, userId: string, rawCode: string, subtotal: Prisma.Decimal) {
    const code = rawCode.trim().toUpperCase();
    const coupon = await db.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) throw new BadRequestException('This coupon code is not valid.');
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This coupon has expired.');
    }
    if (subtotal.lt(coupon.minOrderAmount)) {
      throw new BadRequestException(`Add items worth Rs ${coupon.minOrderAmount} or more to use ${coupon.code}.`);
    }

    const used = { couponCode: coupon.code, status: { not: 'CANCELLED' as const } };
    if (coupon.usageLimit !== null && (await db.order.count({ where: used })) >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }
    if ((await db.order.count({ where: { ...used, userId } })) >= coupon.perUserLimit) {
      throw new BadRequestException('You have already used this coupon.');
    }
    if (coupon.firstOrderOnly && (await db.order.count({ where: { userId, status: { not: 'CANCELLED' } } })) > 0) {
      throw new BadRequestException('This coupon is only for your first order.');
    }

    return { coupon, discount: calculateDiscount(coupon, subtotal) };
  }

  /** Preview for the cart; the real check runs again when the order is placed. */
  async validate(userId: string, code: string, subtotal: number) {
    const { coupon, discount } = await this.evaluate(this.prisma, userId, code, new Prisma.Decimal(subtotal));
    return { code: coupon.code, description: coupon.description, discount: discount.toNumber() };
  }
}
