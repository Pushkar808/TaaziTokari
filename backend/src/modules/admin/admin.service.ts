import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/audit/audit.service';
import { dateOnly } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { toCategory, toNotification, toProduct, toSlot, toZone } from '../catalog/catalog.mapper';
import { toOrder } from '../orders/order.mapper';
import { toAuditLog, toExpense, toStaff, toFeedback, toManualSale, toMovement, toPurchase } from './admin.mapper';
import { toCoupon } from '../coupons/coupon.mapper';
import { CouponDto, ExpenseDto, NotificationDto, ProductDto, StaffDto, ZoneDto } from './dto/admin.dto';

const newestFirst = { createdAt: 'desc' } as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Everything the admin console shows, in one call. Unlike the public catalog it includes inactive rows. */
  async overview() {
    const [
      orders, purchases, manualSales, expenses, movements, feedback, auditLogs,
      categories, zones, slots, notifications, coupons, staff,
    ] = await Promise.all([
      this.prisma.order.findMany({ include: { items: true }, orderBy: newestFirst }),
      this.prisma.purchase.findMany({ orderBy: newestFirst }),
      this.prisma.manualSale.findMany({ orderBy: newestFirst }),
      this.prisma.expense.findMany({ orderBy: newestFirst }),
      this.prisma.inventoryMovement.findMany({ orderBy: newestFirst, take: 200 }),
      this.prisma.customerFeedback.findMany({ orderBy: newestFirst }),
      this.prisma.auditLog.findMany({ orderBy: newestFirst, take: 500 }),
      this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } }),
      this.prisma.deliveryZone.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.deliverySlot.findMany({ orderBy: { title: 'asc' } }),
      this.prisma.notification.findMany({ orderBy: { priority: 'desc' } }),
      this.prisma.coupon.findMany({ orderBy: newestFirst }),
      this.prisma.profile.findMany({ where: { role: 'operations' }, orderBy: newestFirst }),
    ]);
    return {
      orders: orders.map(toOrder),
      purchases: purchases.map(toPurchase),
      manualSales: manualSales.map(toManualSale),
      expenses: expenses.map(toExpense),
      movements: movements.map(toMovement),
      feedback: feedback.map(toFeedback),
      auditLogs: auditLogs.map(toAuditLog),
      categories: categories.map(toCategory),
      zones: zones.map(toZone),
      slots: slots.map(toSlot),
      notifications: notifications.map(toNotification),
      coupons: coupons.map(toCoupon),
      staff: staff.map(toStaff),
    };
  }

  /** What operations staff may see: orders and stock movements, nothing financial. */
  async opsOverview() {
    const [orders, movements] = await Promise.all([
      this.prisma.order.findMany({ include: { items: true }, orderBy: newestFirst }),
      this.prisma.inventoryMovement.findMany({ orderBy: newestFirst, take: 200 }),
    ]);
    return { orders: orders.map(toOrder), movements: movements.map(toMovement) };
  }

  // --- Delivery zones -----------------------------------------------------------
  async createZone(adminId: string, dto: ZoneDto) {
    const pincodes = [...new Set((dto.pincodes ?? []).map((p) => p.trim()))];
    if (pincodes.length === 0) throw new BadRequestException('Add at least one serviceable pincode.');
    const zone = await this.prisma.deliveryZone.create({ data: { ...dto, pincodes } });
    await this.logChange(adminId, 'ZONES_INSERT', 'delivery_zones', zone.id, `Created zone ${zone.name} (${pincodes.join(', ')})`);
    return toZone(zone);
  }

  async updateZone(adminId: string, id: string, dto: ZoneDto) {
    if (dto.pincodes && dto.pincodes.length === 0) throw new BadRequestException('A zone needs at least one pincode.');
    const pincodes = dto.pincodes && [...new Set(dto.pincodes.map((p) => p.trim()))];
    const zone = await this.prisma.deliveryZone.update({ where: { id }, data: { ...dto, pincodes } });
    await this.logChange(adminId, 'ZONES_UPDATE', 'delivery_zones', id, `Updated ${zone.name}: cut-off ${zone.cutoffTime}`);
    return toZone(zone);
  }

  // --- Operations staff ---------------------------------------------------------
  // Only admins create these accounts; there is no public sign-up for staff.
  async createStaff(adminId: string, dto: StaffDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.profile.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists.');
    }
    const staff = await this.prisma.profile.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phoneNumber?.trim() ?? '',
        role: 'operations',
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    await this.logChange(adminId, 'STAFF_INSERT', 'profiles', staff.id, `Created operations login ${email}`);
    return toStaff(staff);
  }

  async deleteStaff(adminId: string, id: string) {
    const staff = await this.prisma.profile.findFirst({ where: { id, role: 'operations' } });
    if (!staff) throw new NotFoundException('Operations login not found.');
    await this.prisma.profile.delete({ where: { id } });
    await this.logChange(adminId, 'STAFF_DELETE', 'profiles', id, `Removed operations login ${staff.email}`);
  }

  // --- Products ---------------------------------------------------------------
  async createProduct(adminId: string, dto: ProductDto) {
    const product = await this.prisma.product.create({ data: { ...dto, topBadge: dto.topBadge || null } });
    await this.logChange(adminId, 'PRODUCTS_INSERT', 'products', product.id, `Created ${product.nameEn}`);
    return toProduct(product);
  }

  async updateProduct(adminId: string, id: string, dto: ProductDto) {
    const product = await this.prisma.product.update({ where: { id }, data: { ...dto, topBadge: dto.topBadge || null } });
    await this.logChange(adminId, 'PRODUCTS_UPDATE', 'products', id, `Updated ${product.nameEn}`);
    return toProduct(product);
  }

  async deleteProduct(adminId: string, id: string) {
    const product = await this.prisma.product.delete({ where: { id } });
    await this.logChange(adminId, 'PRODUCTS_DELETE', 'products', id, `Deleted ${product.nameEn}`);
  }

  // --- Announcements ------------------------------------------------------------
  async createNotification(adminId: string, dto: NotificationDto) {
    const notification = await this.prisma.notification.create({ data: this.notificationColumns(dto) });
    await this.logChange(adminId, 'NOTIFICATIONS_INSERT', 'notifications', notification.id, `Created "${dto.title}"`);
    return toNotification(notification);
  }

  async updateNotification(adminId: string, id: string, dto: NotificationDto) {
    const notification = await this.prisma.notification.update({ where: { id }, data: this.notificationColumns(dto) });
    await this.logChange(adminId, 'NOTIFICATIONS_UPDATE', 'notifications', id, `Updated "${dto.title}"`);
    return toNotification(notification);
  }

  async deleteNotification(adminId: string, id: string) {
    const notification = await this.prisma.notification.delete({ where: { id } });
    await this.logChange(adminId, 'NOTIFICATIONS_DELETE', 'notifications', id, `Deleted "${notification.title}"`);
  }

  // --- Coupons --------------------------------------------------------------------
  async createCoupon(adminId: string, dto: CouponDto) {
    this.checkCoupon(dto);
    const coupon = await this.prisma.coupon.create({ data: this.couponColumns(dto) });
    await this.logChange(adminId, 'COUPONS_INSERT', 'coupons', coupon.id, `Created coupon ${coupon.code}`);
    return toCoupon(coupon);
  }

  async updateCoupon(adminId: string, id: string, dto: CouponDto) {
    this.checkCoupon(dto);
    const coupon = await this.prisma.coupon.update({ where: { id }, data: this.couponColumns(dto) });
    await this.logChange(adminId, 'COUPONS_UPDATE', 'coupons', id, `Updated coupon ${coupon.code}`);
    return toCoupon(coupon);
  }

  async deleteCoupon(adminId: string, id: string) {
    const coupon = await this.prisma.coupon.delete({ where: { id } });
    await this.logChange(adminId, 'COUPONS_DELETE', 'coupons', id, `Deleted coupon ${coupon.code}`);
  }

  // --- Expenses -----------------------------------------------------------------
  async recordExpense(adminId: string, dto: ExpenseDto) {
    const actor = await this.audit.actorName(adminId);
    const expense = await this.prisma.expense.create({
      data: { date: dateOnly(dto.date), category: dto.category, amount: dto.amount, notes: dto.notes ?? '', recordedBy: actor },
    });
    await this.audit.log({
      action: 'EXPENSES_INSERT',
      entityType: 'expenses',
      entityId: expense.id,
      actor,
      details: `${dto.category} Rs ${dto.amount}`,
    });
    return toExpense(expense);
  }

  private checkCoupon(dto: CouponDto) {
    if (dto.discountType === 'PERCENT' && dto.discountValue > 100) {
      throw new BadRequestException('A percentage coupon cannot be more than 100%.');
    }
  }

  /** Codes are stored upper-case; empty optional limits become NULL (no limit). */
  private couponColumns(dto: CouponDto) {
    return {
      ...dto,
      code: dto.code.trim().toUpperCase(),
      description: dto.description ?? '',
      maxDiscount: dto.maxDiscount ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      usageLimit: dto.usageLimit ?? null,
    };
  }

  /** Empty optional text becomes NULL so the UI does not show blank banners or buttons. */
  private notificationColumns(dto: NotificationDto) {
    return {
      ...dto,
      bannerImageUrl: dto.bannerImageUrl || null,
      actionText: dto.actionText || null,
      actionUrl: dto.actionUrl || null,
    };
  }

  private async logChange(adminId: string, action: string, entityType: string, entityId: string, details: string) {
    await this.audit.log({ action, entityType, entityId, actor: await this.audit.actorName(adminId), details });
  }
}
