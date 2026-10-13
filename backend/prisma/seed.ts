// ==============================================================================
// TAAZI TOKARI: PRISMA SEED SCRIPT
// Loads zones, slots, categories, products, announcements and sample purchases /
// expenses from prisma/seedData.ts. Idempotent: existing rows are left untouched,
// so re-running never wipes real orders or edited prices.
// If ADMIN_EMAIL and ADMIN_PASSWORD are set, the admin account is created or updated.
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  INITIAL_ZONES,
  INITIAL_SLOTS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_COUPONS,
  INITIAL_PURCHASES,
  INITIAL_EXPENSES,
} from './seedData';

const prisma = new PrismaClient();

async function seedTable<T extends { id: string }>(
  label: string,
  rows: T[],
  upsert: (row: T) => Promise<unknown>
) {
  for (const row of rows) await upsert(row);
  console.log(`✅ ${label}: ${rows.length}`);
}

async function main() {
  console.log('🌱 Seeding Taazi Tokari...');

  await seedTable('Zones', INITIAL_ZONES, (z) =>
    prisma.deliveryZone.upsert({ where: { id: z.id }, update: {}, create: z })
  );
  await seedTable('Slots', INITIAL_SLOTS, (s) =>
    prisma.deliverySlot.upsert({ where: { id: s.id }, update: {}, create: s })
  );
  await seedTable('Categories', INITIAL_CATEGORIES, (c) =>
    prisma.category.upsert({ where: { id: c.id }, update: {}, create: c })
  );
  await seedTable('Products', INITIAL_PRODUCTS, (p) =>
    prisma.product.upsert({ where: { id: p.id }, update: {}, create: p })
  );
  await seedTable('Notifications', INITIAL_NOTIFICATIONS, (n) =>
    prisma.notification.upsert({ where: { id: n.id }, update: {}, create: n })
  );
  await seedTable('Coupons', INITIAL_COUPONS, (c) =>
    prisma.coupon.upsert({ where: { id: c.id }, update: {}, create: c })
  );
  await seedTable('Purchases', INITIAL_PURCHASES, (p) =>
    prisma.purchase.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, date: new Date(p.date) },
    })
  );
  await seedTable('Expenses', INITIAL_EXPENSES, (e) =>
    prisma.expense.upsert({
      where: { id: e.id },
      update: {},
      create: { ...e, date: new Date(e.date) },
    })
  );

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.profile.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'admin' },
      create: { email: adminEmail, passwordHash, role: 'admin', fullName: 'Admin' },
    });
    console.log(`✅ Admin: ${adminEmail}`);
  }

  console.log('🎉 Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
