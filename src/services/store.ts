// ==============================================================================
// TAAZI TOKARI (ताज़ी टोकरी) - PRODUCTION DATA STORE & REPOSITORY
// Shared data types, plus the in-memory store the UI renders from.
// ==============================================================================

export type UserRole = 'customer' | 'admin' | 'operations';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  pincodes: string[];
  minOrderFreeDelivery: number;
  deliveryFee: number;
  cutoffTime: string; // e.g. "22:00"
  isActive: boolean;
}

export interface CustomerAddress {
  id: string;
  userId: string;
  recipientName: string;
  phoneNumber: string;
  addressLine: string;
  flatNumber: string;
  blockBuilding: string;
  landmark?: string;
  zoneId: string;
  pincode: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isDefault: boolean;
}

export interface DeliverySlot {
  id: string;
  title: string;
  timeRange: string;
  description: string;
  isActive: boolean;
}

export interface ProductCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string;
  iconName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ProductItem {
  id: string;
  nameEn: string;
  nameHi: string;
  categorySlug: string;
  unit: string;
  price: number; // in INR
  mrp: number; // in INR
  stockQty: number; // in units/kg
  weightedCost: number; // weighted average cost per unit
  lowStockThreshold: number;
  isAvailable: boolean;
  isNewArrival: boolean;
  isPopular: boolean;
  isBestPrice: boolean;
  origin: string;
  topBadge?: string;
  description: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  changeQty: number; // positive for purchases, negative for sales
  balanceQtyAfter: number;
  reason: 'PURCHASE' | 'MANUAL_SALE' | 'ONLINE_ORDER' | 'WASTAGE' | 'ADJUSTMENT' | 'INITIAL';
  referenceId?: string;
  notes?: string;
  recordedBy: string;
  timestamp: string;
}

export interface PurchaseRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  totalCost: number; // INR
  unitCost: number; // INR auto-calculated
  supplierName?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ManualSaleRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  sellingPrice: number; // INR per unit
  totalRevenue: number; // INR
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: 'TRANSPORT' | 'PACKAGING' | 'MARKET_TRAVEL' | 'WASTAGE' | 'UTILITIES' | 'OTHER';
  amount: number; // INR
  notes: string;
  recordedBy: string;
  createdAt: string;
}

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  productId: string;
  nameEn: string;
  nameHi: string;
  unit: string;
  price: number;
  mrp: number;
  quantity: number;
  itemTotal: number;
  imageUrl: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  orderDate: string; // business day, YYYY-MM-DD: orders after the zone cut-off count for the next day
  userId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: CustomerAddress;
  deliverySlot: DeliverySlot;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  savingsTotal: number;
  grandTotal: number;
  couponCode?: string;
  discountTotal: number;
  paymentMethod: 'COD' | 'ONLINE_RAZORPAY';
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED';
  orderStatus: OrderStatus;
  deliveryNotes?: string;
  feedbackSubmitted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationOffer {
  id: string;
  title: string;
  message: string;
  type: 'ANNOUNCEMENT' | 'OFFER' | 'HARVEST_ALERT';
  bannerImageUrl?: string;
  actionText?: string;
  actionUrl?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: 'operations';
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  expiresAt?: string;
  usageLimit?: number;
  perUserLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerFeedback {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actor: string;
  details: string;
  timestamp: string;
}

// ==============================================================================
// DATA STORE
// In-memory cache of what the signed-in user may see, filled from the backend API by
// `init()`. Reads are synchronous (components render from the cache); every
// write is async, hits the server, then reloads the cache. Only UI-local state
// (cart, chosen address, first-run flag) lives in localStorage.
// All business rules (prices, fees, stock, costs) are enforced server-side.
// ==============================================================================
import { fetchCatalog } from './api/catalog';
import * as customerApi from './api/customer';
import * as adminApi from './api/admin';

const STORAGE_KEYS = {
  ACTIVE_ADDRESS: 'taazi_tokari_active_address_v3',
  CART: 'taazi_tokari_cart_v3',
  LOCATION_SETUP_DONE: 'taazi_tokari_location_setup_v3',
};

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

class AppDataStore {
  private user: UserProfile | null = null;

  private zones: DeliveryZone[] = [];
  private slots: DeliverySlot[] = [];
  private categories: ProductCategory[] = [];
  private products: ProductItem[] = [];
  private notifications: NotificationOffer[] = [];
  private coupons: Coupon[] = [];
  private staff: StaffMember[] = [];
  private addresses: CustomerAddress[] = [];
  private orders: CustomerOrder[] = [];
  private purchases: PurchaseRecord[] = [];
  private manualSales: ManualSaleRecord[] = [];
  private expenses: ExpenseRecord[] = [];
  private movements: InventoryMovement[] = [];
  private feedback: CustomerFeedback[] = [];
  private auditLogs: AuditLogRecord[] = [];

  // --- Loading ---------------------------------------------------------------
  // Call after boot and after every sign-in/out. Loads public data, then the
  // user's own data (admins also get the back-office tables).
  async init(user: UserProfile | null): Promise<void> {
    this.user = user;
    const catalog = await fetchCatalog();
    this.zones = catalog.zones;
    this.slots = catalog.slots;
    this.categories = catalog.categories;
    this.products = catalog.products;
    this.notifications = catalog.notifications;

    this.addresses = [];
    this.orders = [];
    this.purchases = [];
    this.manualSales = [];
    this.expenses = [];
    this.movements = [];
    this.feedback = [];
    this.auditLogs = [];
    this.coupons = [];
    this.staff = [];
    if (!user) return;

    if (user.role === 'admin') {
      const [addresses, admin] = await Promise.all([customerApi.fetchAddresses(), adminApi.fetchAdminOverview()]);
      this.addresses = addresses;
      this.orders = admin.orders;
      this.purchases = admin.purchases;
      this.manualSales = admin.manualSales;
      this.expenses = admin.expenses;
      this.movements = admin.movements;
      this.feedback = admin.feedback;
      this.auditLogs = admin.auditLogs;
      // Admins also see inactive zones, slots, categories and announcements.
      this.categories = admin.categories;
      this.zones = admin.zones;
      this.slots = admin.slots;
      this.notifications = admin.notifications;
      this.coupons = admin.coupons;
      this.staff = admin.staff;
    } else if (user.role === 'operations') {
      // Operations staff see orders and stock movements only.
      const ops = await adminApi.fetchOpsOverview();
      this.orders = ops.orders;
      this.movements = ops.movements;
    } else {
      const [addresses, orders] = await Promise.all([customerApi.fetchAddresses(), customerApi.fetchOrders()]);
      this.addresses = addresses;
      this.orders = orders;
    }
  }

  reload(): Promise<void> {
    return this.init(this.user);
  }

  getCurrentUser(): UserProfile | null {
    return this.user;
  }

  // --- Location & address (chosen address is kept locally, saved when signed in) --
  isLocationSetupDone(): boolean {
    return localStorage.getItem(STORAGE_KEYS.LOCATION_SETUP_DONE) === 'true';
  }

  setLocationSetupDone(done: boolean): void {
    localStorage.setItem(STORAGE_KEYS.LOCATION_SETUP_DONE, done ? 'true' : 'false');
  }

  getDeliveryZones(): DeliveryZone[] {
    return this.zones;
  }

  getDeliverySlots(): DeliverySlot[] {
    return this.slots;
  }

  getActiveAddress(): CustomerAddress | null {
    const stored = readJson<CustomerAddress | null>(STORAGE_KEYS.ACTIVE_ADDRESS, null);
    if (stored && (!this.user || stored.userId === this.user.id || stored.userId === 'guest')) return stored;
    return this.addresses[0] ?? null;
  }

  setActiveAddress(address: CustomerAddress): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ADDRESS, JSON.stringify(address));
    this.setLocationSetupDone(true);
  }

  getUserAddresses(): CustomerAddress[] {
    return this.addresses;
  }

  // Signed-in users get the address saved to their account; guests keep it locally
  // until checkout (placeOrder saves it then).
  async saveUserAddress(address: CustomerAddress): Promise<CustomerAddress> {
    let result = address;
    if (this.user) {
      const isExisting = this.addresses.some((a) => a.id === address.id);
      result = await customerApi.saveAddress(address, isExisting);
      this.addresses = [result, ...this.addresses.filter((a) => a.id !== result.id)];
    }
    this.setActiveAddress(result);
    return result;
  }

  // --- Catalogue ---------------------------------------------------------------
  getCategories(): ProductCategory[] {
    return this.categories;
  }

  getProducts(): ProductItem[] {
    return this.products;
  }

  async saveProduct(product: ProductItem): Promise<void> {
    const isNew = !this.products.some((p) => p.id === product.id);
    await adminApi.saveProduct(product, isNew);
    await this.reload();
  }

  async deleteProduct(productId: string): Promise<void> {
    await adminApi.deleteProduct(productId);
    await this.reload();
  }

  // --- Cart (local only) -------------------------------------------------------
  getCart(): Record<string, number> {
    return readJson<Record<string, number>>(STORAGE_KEYS.CART, {});
  }

  saveCart(cart: Record<string, number>): void {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  }

  clearCart(): void {
    localStorage.removeItem(STORAGE_KEYS.CART);
  }

  // --- Back-office records (admin) ---------------------------------------------
  getPurchases(): PurchaseRecord[] {
    return this.purchases;
  }

  getManualSales(): ManualSaleRecord[] {
    return this.manualSales;
  }

  getExpenses(): ExpenseRecord[] {
    return this.expenses;
  }

  getInventoryMovements(): InventoryMovement[] {
    return this.movements;
  }

  getFeedback(): CustomerFeedback[] {
    return this.feedback;
  }

  getAuditLogs(): AuditLogRecord[] {
    return this.auditLogs;
  }

  async recordPurchase(purchase: Parameters<typeof adminApi.recordPurchase>[0]): Promise<void> {
    await adminApi.recordPurchase(purchase);
    await this.reload();
  }

  async recordManualSale(sale: Parameters<typeof adminApi.recordManualSale>[0]): Promise<void> {
    await adminApi.recordManualSale(sale);
    await this.reload();
  }

  async recordExpense(expense: Omit<ExpenseRecord, 'id' | 'createdAt'>): Promise<void> {
    await adminApi.recordExpense(expense);
    await this.reload();
  }

  getBusinessMetrics(dateFilter?: string): Promise<adminApi.BusinessMetrics> {
    return adminApi.fetchBusinessMetrics(dateFilter);
  }

  // --- Orders -------------------------------------------------------------------
  getOrders(): CustomerOrder[] {
    return this.orders;
  }

  // Server prices the order, so only ids and quantities are sent.
  async placeOrder(input: {
    slotId: string;
    paymentMethod: 'COD' | 'ONLINE_RAZORPAY';
    deliveryNotes?: string;
    couponCode?: string;
    items: { productId: string; quantity: number }[];
  }): Promise<CustomerOrder> {
    let address = this.getActiveAddress();
    if (!address) throw new Error('Please confirm your delivery address.');
    if (!this.addresses.some((a) => a.id === address!.id)) address = await this.saveUserAddress(address);

    const order = await customerApi.placeOrder({ ...input, addressId: address.id });
    this.clearCart();
    await this.reload();
    return order;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await adminApi.updateOrderStatus(orderId, status);
    await this.reload();
  }

  async submitFeedback(orderId: string, rating: number, comment: string): Promise<void> {
    await customerApi.submitFeedback(orderId, rating, comment);
    await this.reload();
  }

  // --- Announcements --------------------------------------------------------------
  getNotifications(): NotificationOffer[] {
    return this.notifications;
  }

  async saveNotification(notif: NotificationOffer): Promise<void> {
    const isNew = !this.notifications.some((n) => n.id === notif.id);
    await adminApi.saveNotification(notif, isNew);
    await this.reload();
  }

  async deleteNotification(id: string): Promise<void> {
    await adminApi.deleteNotification(id);
    await this.reload();
  }

  // --- Delivery zones & staff ----------------------------------------------------------
  async saveZone(zone: DeliveryZone): Promise<void> {
    await adminApi.saveZone(zone);
    await this.reload();
  }

  async createZone(zone: Omit<DeliveryZone, 'id'>): Promise<void> {
    await adminApi.createZone(zone);
    await this.reload();
  }

  getStaff(): StaffMember[] {
    return this.staff;
  }

  async createStaff(input: { fullName: string; email: string; phoneNumber?: string; password: string }): Promise<void> {
    await adminApi.createStaff(input);
    await this.reload();
  }

  async deleteStaff(id: string): Promise<void> {
    await adminApi.deleteStaff(id);
    await this.reload();
  }

  // --- Coupons ----------------------------------------------------------------------
  getCoupons(): Coupon[] {
    return this.coupons;
  }

  async saveCoupon(coupon: Omit<Coupon, 'createdAt'>): Promise<void> {
    const isNew = !this.coupons.some((c) => c.id === coupon.id);
    await adminApi.saveCoupon(coupon, isNew);
    await this.reload();
  }

  async deleteCoupon(id: string): Promise<void> {
    await adminApi.deleteCoupon(id);
    await this.reload();
  }

  // Preview for the cart. The server checks the code again when the order is placed.
  validateCoupon(code: string, subtotal: number, silent = false) {
    return customerApi.validateCoupon(code, subtotal, silent);
  }
}

export const appStore = new AppDataStore();
