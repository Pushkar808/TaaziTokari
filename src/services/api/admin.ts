// Admin-only data and actions. The API rejects anyone whose role is not admin.
import { http } from './http';
import type {
  AuditLogRecord, Coupon, CustomerFeedback, StaffMember, CustomerOrder, DeliverySlot, DeliveryZone, ExpenseRecord, InventoryMovement,
  ManualSaleRecord, NotificationOffer, OrderStatus, ProductCategory, ProductItem, PurchaseRecord,
} from '../store';

// Everything the console shows. Zones, slots, categories and announcements include inactive ones.
export interface AdminOverview {
  orders: CustomerOrder[];
  purchases: PurchaseRecord[];
  manualSales: ManualSaleRecord[];
  expenses: ExpenseRecord[];
  movements: InventoryMovement[];
  feedback: CustomerFeedback[];
  auditLogs: AuditLogRecord[];
  categories: ProductCategory[];
  zones: DeliveryZone[];
  slots: DeliverySlot[];
  notifications: NotificationOffer[];
  coupons: Coupon[];
  staff: StaffMember[];
}

export const fetchAdminOverview = () => http.get<AdminOverview>('/admin/overview');

export const saveProduct = (product: ProductItem, isNew: boolean) =>
  isNew ? http.post('/admin/products', product) : http.patch(`/admin/products/${product.id}`, product);

export const deleteProduct = (id: string) => http.delete(`/admin/products/${id}`);

export const saveNotification = (notification: NotificationOffer, isNew: boolean) =>
  isNew
    ? http.post('/admin/notifications', notification)
    : http.patch(`/admin/notifications/${notification.id}`, notification);

export const deleteNotification = (id: string) => http.delete(`/admin/notifications/${id}`);

export const recordExpense = (expense: Pick<ExpenseRecord, 'date' | 'category' | 'amount' | 'notes'>) =>
  http.post('/admin/expenses', expense);

export const recordPurchase = (
  purchase: Pick<PurchaseRecord, 'date' | 'productId' | 'quantity' | 'totalCost' | 'supplierName' | 'notes'>
) => http.post('/admin/purchases', purchase);

export const recordManualSale = (
  sale: Pick<ManualSaleRecord, 'date' | 'productId' | 'quantity' | 'sellingPrice' | 'notes'>
) => http.post('/admin/manual-sales', sale);

export const updateOrderStatus = (orderId: string, status: OrderStatus) =>
  http.patch(`/admin/orders/${orderId}/status`, { status });

export interface BusinessMetrics {
  targetDate: string;
  totalSalesRevenue: number;
  onlineSalesRevenue: number;
  manualSalesRevenue: number;
  totalPurchaseSpending: number;
  totalOperatingExpenses: number;
  cogs: number;
  estimatedGrossProfit: number;
  estimatedNetOperatingProfit: number;
  totalInventoryValue: number;
  lowStockCount: number;
  orderCount: number;
}

// Without a date the server uses today (India time).
export const fetchBusinessMetrics = (date?: string) =>
  http.get<BusinessMetrics>(date ? `/admin/metrics?date=${date}` : '/admin/metrics');

export const saveCoupon = (coupon: Omit<Coupon, 'createdAt'>, isNew: boolean) =>
  isNew ? http.post('/admin/coupons', coupon) : http.patch(`/admin/coupons/${coupon.id}`, coupon);

export const deleteCoupon = (id: string) => http.delete(`/admin/coupons/${id}`);

// Operations staff get a trimmed view: orders and stock movements only.
export const fetchOpsOverview = () =>
  http.get<{ orders: CustomerOrder[]; movements: InventoryMovement[] }>('/admin/ops/overview');

export const saveZone = (zone: DeliveryZone) =>
  http.patch(`/admin/zones/${zone.id}`, {
    name: zone.name,
    pincodes: zone.pincodes,
    cutoffTime: zone.cutoffTime,
    deliveryFee: zone.deliveryFee,
    minOrderFreeDelivery: zone.minOrderFreeDelivery,
    isActive: zone.isActive,
  });

export const createZone = (zone: Omit<DeliveryZone, 'id'>) => http.post<DeliveryZone>('/admin/zones', zone);

export const createStaff = (staff: { fullName: string; email: string; phoneNumber?: string; password: string }) =>
  http.post<StaffMember>('/admin/staff', staff);

export const deleteStaff = (id: string) => http.delete(`/admin/staff/${id}`);
