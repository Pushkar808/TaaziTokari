import { Prisma } from '@prisma/client';

/** Prisma Decimal -> plain number, for JSON responses. Null (an empty SUM) counts as 0. */
export const num = (value: Prisma.Decimal | null | undefined): number => (value ? value.toNumber() : 0);

/** Rounds to 2 decimals (paise). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;
