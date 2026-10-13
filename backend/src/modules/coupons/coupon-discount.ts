import { DiscountType, Prisma } from '@prisma/client';

type DiscountRule = {
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  maxDiscount: Prisma.Decimal | null;
};

/** Rupees off the item subtotal: percent or flat, capped by `maxDiscount`, never above the subtotal. */
export function calculateDiscount(coupon: DiscountRule, subtotal: Prisma.Decimal): Prisma.Decimal {
  let discount =
    coupon.discountType === 'PERCENT'
      ? subtotal.mul(coupon.discountValue).div(100).toDecimalPlaces(2)
      : coupon.discountValue;
  if (coupon.maxDiscount && discount.gt(coupon.maxDiscount)) discount = coupon.maxDiscount;
  if (discount.gt(subtotal)) discount = subtotal;
  return discount.isNegative() ? new Prisma.Decimal(0) : discount;
}
