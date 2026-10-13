import { Order, OrderItem } from '@prisma/client';
import { formatDateOnly } from '../../common/dates';
import { num } from '../../common/numbers';

export const toOrder = (o: Order & { items: OrderItem[] }) => ({
  id: o.id,
  orderNumber: o.orderNumber,
  orderDate: formatDateOnly(o.orderDate),
  userId: o.userId,
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  deliveryAddress: o.deliveryAddress,
  deliverySlot: o.deliverySlot,
  items: o.items.map((i) => ({
    productId: i.productId,
    nameEn: i.nameEn,
    nameHi: i.nameHi,
    unit: i.unit,
    price: num(i.price),
    mrp: num(i.mrp),
    quantity: num(i.quantity),
    itemTotal: num(i.itemTotal),
    imageUrl: i.imageUrl,
  })),
  subtotal: num(o.subtotal),
  deliveryFee: num(o.deliveryFee),
  savingsTotal: num(o.savingsTotal),
  grandTotal: num(o.grandTotal),
  couponCode: o.couponCode ?? undefined,
  discountTotal: num(o.discountTotal),
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  orderStatus: o.status,
  deliveryNotes: o.deliveryNotes ?? undefined,
  feedbackSubmitted: o.feedbackSubmitted,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
