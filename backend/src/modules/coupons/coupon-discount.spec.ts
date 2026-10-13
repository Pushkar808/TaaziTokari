import { Prisma } from '@prisma/client';
import { calculateDiscount } from './coupon-discount';

const D = (n: number) => new Prisma.Decimal(n);
const rule = (discountType: 'PERCENT' | 'FLAT', value: number, max: number | null = null) => ({
  discountType,
  discountValue: D(value),
  maxDiscount: max === null ? null : D(max),
});

describe('calculateDiscount', () => {
  it('takes a percentage of the subtotal', () => {
    expect(calculateDiscount(rule('PERCENT', 10), D(250)).toNumber()).toBe(25);
  });

  it('rounds a percentage to paise', () => {
    expect(calculateDiscount(rule('PERCENT', 15), D(33.33)).toNumber()).toBe(5);
  });

  it('gives a flat amount', () => {
    expect(calculateDiscount(rule('FLAT', 50), D(300)).toNumber()).toBe(50);
  });

  it('caps a percentage at the max discount', () => {
    expect(calculateDiscount(rule('PERCENT', 50, 100), D(1000)).toNumber()).toBe(100);
  });

  it('never exceeds the subtotal', () => {
    expect(calculateDiscount(rule('FLAT', 50), D(30)).toNumber()).toBe(30);
    expect(calculateDiscount(rule('PERCENT', 100), D(80)).toNumber()).toBe(80);
  });
});
