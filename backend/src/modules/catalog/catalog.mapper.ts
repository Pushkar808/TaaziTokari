import { Category, DeliverySlot, DeliveryZone, Notification, Product } from '@prisma/client';
import { num } from '../../common/numbers';

export const toZone = (z: DeliveryZone) => ({
  id: z.id,
  name: z.name,
  pincodes: z.pincodes,
  minOrderFreeDelivery: num(z.minOrderFreeDelivery),
  deliveryFee: num(z.deliveryFee),
  cutoffTime: z.cutoffTime,
  isActive: z.isActive,
});

export const toSlot = (s: DeliverySlot) => ({
  id: s.id,
  title: s.title,
  timeRange: s.timeRange,
  description: s.description,
  isActive: s.isActive,
});

export const toCategory = (c: Category) => ({
  id: c.id,
  slug: c.slug,
  nameEn: c.nameEn,
  nameHi: c.nameHi,
  iconName: c.iconName,
  displayOrder: c.displayOrder,
  isActive: c.isActive,
});

export const toProduct = (p: Product) => ({
  id: p.id,
  nameEn: p.nameEn,
  nameHi: p.nameHi,
  categorySlug: p.categorySlug,
  unit: p.unit,
  price: num(p.price),
  mrp: num(p.mrp),
  stockQty: num(p.stockQty),
  weightedCost: num(p.weightedCost),
  lowStockThreshold: num(p.lowStockThreshold),
  isAvailable: p.isAvailable,
  isNewArrival: p.isNewArrival,
  isPopular: p.isPopular,
  isBestPrice: p.isBestPrice,
  origin: p.origin,
  topBadge: p.topBadge ?? undefined,
  description: p.description,
  imageUrl: p.imageUrl,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const toNotification = (n: Notification) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  type: n.type,
  bannerImageUrl: n.bannerImageUrl ?? undefined,
  actionText: n.actionText ?? undefined,
  actionUrl: n.actionUrl ?? undefined,
  isActive: n.isActive,
  priority: n.priority,
  createdAt: n.createdAt,
});
