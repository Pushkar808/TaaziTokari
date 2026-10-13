import { Coupon } from '@prisma/client';
import { num } from '../../common/numbers';

export const toCoupon = (c: Coupon) => ({
  id: c.id,
  code: c.code,
  description: c.description,
  discountType: c.discountType,
  discountValue: num(c.discountValue),
  minOrderAmount: num(c.minOrderAmount),
  maxDiscount: c.maxDiscount ? num(c.maxDiscount) : undefined,
  expiresAt: c.expiresAt ?? undefined,
  usageLimit: c.usageLimit ?? undefined,
  perUserLimit: c.perUserLimit,
  firstOrderOnly: c.firstOrderOnly,
  isActive: c.isActive,
  createdAt: c.createdAt,
});
