import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toCategory, toNotification, toProduct, toSlot, toZone } from './catalog.mapper';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything a visitor needs to browse the shop. Inactive rows are hidden. */
  async getCatalog() {
    const active = { where: { isActive: true } };
    const [products, categories, zones, slots, notifications] = await Promise.all([
      this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.category.findMany({ ...active, orderBy: { displayOrder: 'asc' } }),
      this.prisma.deliveryZone.findMany({ ...active, orderBy: { name: 'asc' } }),
      this.prisma.deliverySlot.findMany({ ...active, orderBy: { title: 'asc' } }),
      this.prisma.notification.findMany({ ...active, orderBy: { priority: 'desc' } }),
    ]);
    return {
      products: products.map(toProduct),
      categories: categories.map(toCategory),
      zones: zones.map(toZone),
      slots: slots.map(toSlot),
      notifications: notifications.map(toNotification),
    };
  }
}
