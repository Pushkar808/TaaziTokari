import {
  AuditLog, CustomerFeedback, Expense, InventoryMovement, ManualSale, Profile, Purchase,
} from '@prisma/client';
import { formatDateOnly } from '../../common/dates';
import { num } from '../../common/numbers';

export const toMovement = (m: InventoryMovement) => ({
  id: m.id,
  productId: m.productId,
  productName: m.productName,
  changeQty: num(m.changeQty),
  balanceQtyAfter: num(m.balanceQtyAfter),
  reason: m.reason,
  referenceId: m.referenceId ?? undefined,
  notes: m.notes ?? undefined,
  recordedBy: m.recordedBy,
  timestamp: m.createdAt,
});

export const toPurchase = (p: Purchase) => ({
  id: p.id,
  date: formatDateOnly(p.date),
  productId: p.productId,
  productName: p.productName,
  quantity: num(p.quantity),
  unit: p.unit,
  totalCost: num(p.totalCost),
  unitCost: num(p.unitCost),
  supplierName: p.supplierName ?? undefined,
  notes: p.notes ?? undefined,
  recordedBy: p.recordedBy,
  createdAt: p.createdAt,
});

export const toManualSale = (s: ManualSale) => ({
  id: s.id,
  date: formatDateOnly(s.date),
  productId: s.productId,
  productName: s.productName,
  quantity: num(s.quantity),
  unit: s.unit,
  sellingPrice: num(s.sellingPrice),
  totalRevenue: num(s.totalRevenue),
  notes: s.notes ?? undefined,
  recordedBy: s.recordedBy,
  createdAt: s.createdAt,
});

export const toExpense = (e: Expense) => ({
  id: e.id,
  date: formatDateOnly(e.date),
  category: e.category,
  amount: num(e.amount),
  notes: e.notes,
  recordedBy: e.recordedBy,
  createdAt: e.createdAt,
});

export const toFeedback = (f: CustomerFeedback) => ({
  id: f.id,
  orderId: f.orderId,
  orderNumber: f.orderNumber,
  userId: f.userId,
  customerName: f.customerName,
  rating: f.rating,
  comment: f.comment,
  createdAt: f.createdAt,
});

export const toAuditLog = (l: AuditLog) => ({
  id: l.id,
  action: l.action,
  entityType: l.entityType,
  entityId: l.entityId ?? undefined,
  actor: l.actor,
  details: l.details,
  timestamp: l.createdAt,
});

export const toStaff = (p: Profile) => ({
  id: p.id,
  email: p.email,
  fullName: p.fullName,
  phoneNumber: p.phone,
  role: p.role,
  createdAt: p.createdAt,
});
