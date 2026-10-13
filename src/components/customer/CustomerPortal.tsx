// ==============================================================================
// TAAZI TOKARI (ताज़ी टोकरी) - CUSTOMER SHOPPING PORTAL
// Single clean navbar, high-res produce catalog, category filtering,
// search, persistent cart, delivery slot selection, checkout,
// order history tracking, and unobtrusive feedback prompt.
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  ProductItem,
  ProductCategory,
  CustomerAddress,
  CustomerOrder,
  DeliverySlot,
  UserProfile,
  appStore,
} from '../../services/store';
import { TaaziTokariEmblem } from '../BrandLogo';

interface CustomerPortalProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenLocation: () => void;
  onSwitchToAdmin?: () => void;
  onSignOut: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  currentUser,
  onOpenAuth,
  onOpenLocation,
  onSwitchToAdmin,
  onSignOut,
}) => {
  // Store states
  const [products, setProducts] = useState<ProductItem[]>(appStore.getProducts());
  const [categories] = useState<ProductCategory[]>(appStore.getCategories());
  const [slots] = useState<DeliverySlot[]>(appStore.getDeliverySlots());
  const [notifications] = useState(appStore.getNotifications());
  const [activeAddress, setActiveAddress] = useState<CustomerAddress | null>(appStore.getActiveAddress());
  const [cart, setCart] = useState<Record<string, number>>(appStore.getCart());
  // Admins also receive every customer's orders, so keep only this user's here
  const myOrders = () => appStore.getOrders().filter((o) => o.userId === currentUser?.id);
  const [orders, setOrders] = useState<CustomerOrder[]>(myOrders());

  // UI state
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(slots[0]?.id || 'slot-dawn');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE_RAZORPAY'>('COD');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState<CustomerOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Coupon: the code box text, and the code the server accepted (with its discount for this subtotal).
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; description: string; discount: number } | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  // Feedback prompt state
  const [feedbackOrder, setFeedbackOrder] = useState<CustomerOrder | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  // Toast trigger
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Sync cart to storage
  useEffect(() => {
    appStore.saveCart(cart);
  }, [cart]);

  // Check for delivered orders requiring feedback
  useEffect(() => {
    const delivered = orders.find(
      (o) => o.orderStatus === 'DELIVERED' && !o.feedbackSubmitted
    );
    if (delivered) {
      setFeedbackOrder(delivered);
    }
  }, [orders, currentUser]);

  // Keep active address in sync
  useEffect(() => {
    const addr = appStore.getActiveAddress();
    setActiveAddress(addr);
  }, []);

  // Cart operations
  const updateQuantity = (productId: string, delta: number, productName: string) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[productId];
        showToast(`Removed ${productName} from cart`);
      } else {
        updated[productId] = next;
        if (delta > 0 && current === 0) {
          showToast(`Added ${productName} to tomorrow's harvest basket`);
        }
      }
      return updated;
    });
  };

  // Cart calculations
  const cartLineItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod || quantity <= 0) return null;
        return {
          productId,
          product: prod,
          quantity,
          itemTotal: prod.price * quantity,
          savings: (prod.mrp - prod.price) * quantity,
        };
      })
      .filter(Boolean) as {
        productId: string;
        product: ProductItem;
        quantity: number;
        itemTotal: number;
        savings: number;
      }[];
  }, [cart, products]);

  const cartItemCount = cartLineItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartLineItems.reduce((sum, item) => sum + item.itemTotal, 0);
  const cartSavings = cartLineItems.reduce((sum, item) => sum + item.savings, 0);

  // Delivery fee logic
  const activeZone = appStore.getDeliveryZones().find((z) => z.id === activeAddress?.zoneId) || appStore.getDeliveryZones()[0];
  const isDeliveryFree = cartSubtotal >= (activeZone?.minOrderFreeDelivery || 199);
  const deliveryFee = cartSubtotal > 0 ? (isDeliveryFree ? 0 : activeZone?.deliveryFee || 25) : 0;
  const couponDiscount = cartSubtotal > 0 ? appliedCoupon?.discount ?? 0 : 0;
  const grandTotal = cartSubtotal - couponDiscount + deliveryFee;

  const handleApplyCoupon = async () => {
    if (!currentUser) {
      showToast('Please sign in to use a coupon.');
      onOpenAuth();
      return;
    }
    if (!couponInput.trim()) return;
    setIsCheckingCoupon(true);
    try {
      setAppliedCoupon(await appStore.validateCoupon(couponInput, cartSubtotal));
      setCouponInput('');
    } catch (err: any) {
      showToast(err.message || 'Could not apply this coupon.');
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  // The discount depends on the subtotal, so ask the server again whenever the cart changes.
  useEffect(() => {
    if (!appliedCoupon) return;
    if (cartSubtotal === 0) {
      setAppliedCoupon(null);
      return;
    }
    let stale = false;
    appStore
      .validateCoupon(appliedCoupon.code, cartSubtotal, true)
      .then((result) => {
        if (!stale) setAppliedCoupon(result);
      })
      .catch((err: any) => {
        if (stale) return;
        setAppliedCoupon(null);
        showToast(err.message || 'Coupon removed.');
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSubtotal]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      if (selectedCategorySlug === 'new-arrivals') {
        if (!prod.isNewArrival) return false;
      } else if (selectedCategorySlug === 'popular') {
        if (!prod.isPopular) return false;
      } else if (selectedCategorySlug === 'best-prices') {
        if (!prod.isBestPrice) return false;
      } else if (selectedCategorySlug !== 'all') {
        if (prod.categorySlug !== selectedCategorySlug) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNameEn = prod.nameEn.toLowerCase().includes(q);
        const matchesNameHi = prod.nameHi.toLowerCase().includes(q);
        const matchesDesc = prod.description.toLowerCase().includes(q);
        const matchesOrigin = prod.origin.toLowerCase().includes(q);
        return matchesNameEn || matchesNameHi || matchesDesc || matchesOrigin;
      }

      return true;
    });
  }, [products, selectedCategorySlug, searchQuery]);

  // Handle Checkout submission
  const handlePlaceOrder = async () => {
    if (!currentUser) {
      showToast('Please sign in or register to place your order.');
      onOpenAuth();
      return;
    }

    if (!activeAddress) {
      showToast('Please confirm your delivery address.');
      onOpenLocation();
      return;
    }

    if (cartLineItems.length === 0) {
      showToast('Your cart is empty. Please add fresh items.');
      return;
    }

    const selectedSlot = slots.find((s) => s.id === selectedSlotId) || slots[0];

    // The server prices the order and deducts stock, so only ids and quantities are sent.
    try {
      const created = await appStore.placeOrder({
        slotId: selectedSlot.id,
        paymentMethod,
        deliveryNotes: deliveryNotes.trim() || undefined,
        couponCode: appliedCoupon?.code,
        items: cartLineItems.map((ci) => ({ productId: ci.productId, quantity: ci.quantity })),
      });
      setCart({});
      setAppliedCoupon(null);
      setCouponInput('');
      setProducts(appStore.getProducts());
      setOrders(myOrders());
      setIsCartOpen(false);
      setOrderConfirmed(created);
    } catch (err: any) {
      showToast(err.message || 'Could not place your order. Please try again.');
      setProducts(appStore.getProducts());
    }
  };

  // Handle Feedback Submission
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackOrder) return;
    try {
      await appStore.submitFeedback(feedbackOrder.id, feedbackRating, feedbackComment.trim());
      setOrders(myOrders());
      setFeedbackOrder(null);
      showToast('Dhanyawad! Your feedback helps us maintain fresh quality.');
    } catch (err: any) {
      showToast(err.message || 'Could not submit feedback.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] text-[#151e17] flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-[#072917] text-white px-5 py-3 rounded-2xl shadow-xl border border-[#1b4e30] text-xs font-bold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP ANNOUNCEMENT TICKER */}
      <div className="bg-[#031d10] text-[#bdeecd] px-4 py-1.5 text-xs font-semibold flex items-center justify-between border-b border-[#1e4b33]">
        <div className="flex items-center gap-2 overflow-hidden max-w-4xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-[#f4a62a] animate-pulse shrink-0" />
            <span className="truncate">
              🌾 <strong className="text-white">ताज़ी टोकरी लखनऊ:</strong> Dawn Harvest Cut-off is active! Order before 10:00 PM for 6:00 AM Fresh Doorstep Delivery.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] text-[#8bba9b]">
            <span>📞 Support: +91 94500 12345</span>
            <span>📍 Gomti Nagar Hub</span>
          </div>
        </div>
      </div>

      {/* SINGLE MAIN BRAND HEADER & NAV */}
      <header className="bg-[#072917] text-white sticky top-0 z-40 shadow-lg border-b border-[#14482a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* 1. Brand Logo & Title */}
            <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setSelectedCategorySlug('all')}>
              <TaaziTokariEmblem size={44} className="hover:scale-105 transition-transform drop-shadow" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-md text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    Taazi Tokari
                  </span>
                  <span className="bg-[#f4a62a] text-[#072917] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline">
                    ताज़ी टोकरी
                  </span>
                </div>
                <p className="text-[11px] text-[#8bba9b] font-semibold hidden md:block">
                  Farm-to-Kitchen Fresh Produce • Lucknow
                </p>
              </div>
            </div>

            {/* 2. Delivery Location Pill */}
            <button
              onClick={onOpenLocation}
              className="bg-[#0e3b23] hover:bg-[#155030] border border-[#236841] text-white px-3 py-1.5 rounded-2xl flex items-center gap-2 transition-all shadow-sm max-w-[200px] sm:max-w-xs truncate"
              title="Change Delivery Location"
            >
              <span className="text-amber-400 text-sm shrink-0">📍</span>
              <div className="text-left truncate">
                <span className="text-[10px] text-[#8bba9b] font-bold block uppercase tracking-wider">
                  Deliver to
                </span>
                <span className="text-xs font-bold text-white truncate block">
                  {activeAddress ? `${activeAddress.blockBuilding}, ${activeAddress.flatNumber}` : 'Select Lucknow Location'}
                </span>
              </div>
              <span className="text-gray-400 text-xs hidden sm:inline">▼</span>
            </button>

            {/* 3. Actions: Orders, Cart, Profile */}
            <div className="flex items-center gap-2 shrink-0">
              {/* If user is Admin, provide direct Portal Switcher */}
              {currentUser?.role === 'admin' && onSwitchToAdmin && (
                <button
                  onClick={onSwitchToAdmin}
                  className="bg-[#bdeecd] hover:bg-emerald-300 text-[#002111] px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                  title="Switch to Admin Control Center"
                >
                  <span>⚙️</span>
                  <span className="hidden sm:inline">Admin Center</span>
                </button>
              )}

              {/* Order History */}
              {currentUser && (
                <button
                  onClick={() => setIsOrdersOpen(true)}
                  className="bg-[#0e3b23] hover:bg-[#155030] border border-[#236841] text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all hidden sm:flex items-center gap-1.5"
                >
                  <span>📦</span>
                  <span>My Orders</span>
                </button>
              )}

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="bg-[#f4a62a] hover:bg-[#e0951e] active:scale-[0.98] text-[#072917] px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-md"
              >
                <span className="text-base">🛒</span>
                <span className="font-black">₹{cartSubtotal}</span>
                {cartItemCount > 0 && (
                  <span className="bg-[#072917] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>

              {/* Profile or Sign In */}
              {currentUser ? (
                <div className="flex items-center gap-2 pl-1">
                  <button
                    onClick={() => setIsOrdersOpen(true)}
                    className="flex items-center gap-2 text-left bg-[#0e3b23] hover:bg-[#155030] border border-[#236841] px-2.5 py-1.5 rounded-2xl"
                  >
                    <img
                      src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt={currentUser.fullName}
                      className="w-6 h-6 rounded-full object-cover border border-[#f4a62a]"
                    />
                    <span className="text-xs font-bold text-white hidden md:inline truncate max-w-[90px]">
                      {currentUser.fullName.split(' ')[0]}
                    </span>
                  </button>
                  <button
                    onClick={onSignOut}
                    className="text-[11px] text-[#8bba9b] hover:text-white underline hidden sm:inline"
                    title="Sign Out"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="bg-[#124b2f] hover:bg-[#185a39] border border-[#236841] text-white px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search farm fresh vegetables, fruits, or daily essentials (उदा. टमाटर, आलू, पालक, सेब)..."
                className="w-full bg-[#031d10] border border-[#1b4e30] rounded-2xl py-2.5 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f4a62a] transition-all"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* UNOBTRUSIVE FEEDBACK PROMPT (Only shown when a delivered order exists) */}
        {feedbackOrder && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌟</span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                  Order Delivered • #{feedbackOrder.orderNumber}
                </span>
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                How was the freshness and quality of your delivered produce?
              </h4>
              <p className="text-xs text-gray-600">
                Your quick rating helps our dawn mandi procurement team maintain Grade-A standards.
              </p>
            </div>

            <form onSubmit={handleSubmitFeedback} className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Star Rating */}
              <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="text-lg transition-transform hover:scale-110"
                  >
                    {star <= feedbackRating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Optional short feedback (उदा. बहुत ताज़ी थी)..."
                className="bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 flex-1 md:w-56"
              />

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackOrder(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs px-2 py-2"
                  title="Dismiss"
                >
                  Dismiss
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PROMOTIONAL ANNOUNCEMENT BANNER */}
        {notifications.length > 0 && notifications[0].isActive && (
          <div className="bg-gradient-to-r from-[#072917] to-[#124b2f] rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4 border border-[#1b5033]">
            <div className="space-y-1">
              <span className="bg-[#f4a62a] text-[#072917] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Direct Farm Connect
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                {notifications[0].title}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl">
                {notifications[0].message}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 px-4 py-2 rounded-2xl text-center border border-white/15">
                <span className="text-[10px] text-emerald-300 block uppercase font-bold">Cutoff</span>
                <span className="text-sm font-black text-amber-300">10:00 PM Tonight</span>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-2xl text-center border border-white/15">
                <span className="text-[10px] text-emerald-300 block uppercase font-bold">Delivery</span>
                <span className="text-sm font-black text-white">6:00 AM Dawn</span>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY FILTER TABS (Large, readable, touch-friendly) */}
        <div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => {
              const isSelected = selectedCategorySlug === cat.slug;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-md scale-[1.02]'
                      : 'bg-white hover:bg-emerald-50 text-gray-700 border border-gray-200'
                  }`}
                >
                  <span>{cat.nameEn}</span>
                  <span className={`text-[11px] font-normal ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                    ({cat.nameHi})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PRODUCT CATALOG GRID */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>Fresh Farm Harvest</span>
              <span className="text-xs font-normal text-gray-500">
                ({filteredProducts.length} items available)
              </span>
            </h3>
            {searchQuery && (
              <span className="text-xs text-emerald-700 font-semibold">
                Filtering by &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
              <span className="text-4xl block">🌾</span>
              <h4 className="text-base font-bold text-gray-800">No produce items found</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No items match your search &quot;{searchQuery}&quot;. Try clearing filters or searching for staples like tomato, potato, or spinach.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategorySlug('all'); }}
                className="mt-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl"
              >
                View All Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {filteredProducts.map((prod) => {
                const qtyInCart = cart[prod.id] || 0;
                const isOutOfStock = prod.stockQty <= 0;
                const isLowStock = prod.stockQty > 0 && prod.stockQty <= prod.lowStockThreshold;

                return (
                  <div
                    key={prod.id}
                    className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                  >
                    {/* Produce Image Container */}
                    <div className="relative aspect-square w-full bg-gray-50 overflow-hidden">
                      <img
                        src={prod.imageUrl}
                        alt={prod.nameEn}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                        {prod.topBadge && (
                          <span className="bg-[#072917] text-[#bdeecd] text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                            {prod.topBadge}
                          </span>
                        )}
                        {prod.isNewArrival && (
                          <span className="bg-[#f4a62a] text-[#072917] text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                            New Harvest
                          </span>
                        )}
                      </div>

                      {/* Stock Warning */}
                      {isOutOfStock ? (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                            Sold Out (कल उपलब्ध)
                          </span>
                        </div>
                      ) : isLowStock ? (
                        <span className="absolute bottom-2 left-2 bg-amber-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                          Only {prod.stockQty} left
                        </span>
                      ) : null}
                    </div>

                    {/* Produce Details */}
                    <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          {prod.origin}
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 leading-snug mt-0.5">
                          {prod.nameEn}
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          {prod.nameHi} • <span className="font-bold text-gray-700">{prod.unit}</span>
                        </p>
                      </div>

                      {/* Pricing and Cart Stepper */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base sm:text-lg font-black text-gray-900">
                              ₹{prod.price}
                            </span>
                            {prod.mrp > prod.price && (
                              <span className="text-xs text-gray-400 line-through">
                                ₹{prod.mrp}
                              </span>
                            )}
                          </div>
                          {prod.mrp > prod.price && (
                            <span className="text-[10px] font-extrabold text-emerald-700 block">
                              Save ₹{prod.mrp - prod.price}
                            </span>
                          )}
                        </div>

                        {/* Touch-Friendly Quantity Stepper */}
                        {!isOutOfStock && (
                          <div>
                            {qtyInCart > 0 ? (
                              <div className="flex items-center bg-[#072917] text-white rounded-2xl p-0.5 shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(prod.id, -1, prod.nameEn)}
                                  className="w-8 h-8 rounded-xl hover:bg-white/20 active:scale-95 flex items-center justify-center font-black text-sm"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="w-7 text-center font-black text-xs">
                                  {qtyInCart}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(prod.id, 1, prod.nameEn)}
                                  className="w-8 h-8 rounded-xl hover:bg-white/20 active:scale-95 flex items-center justify-center font-black text-sm"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateQuantity(prod.id, 1, prod.nameEn)}
                                className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-2xl shadow-sm transition-all flex items-center gap-1"
                              >
                                <span>+</span>
                                <span>ADD</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* PERSISTENT CART & CHECKOUT SLIDE-OVER DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div
            className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cart Header */}
            <div className="bg-[#072917] px-6 py-4 text-white flex items-center justify-between border-b border-[#14482a]">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛒</span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Tomorrow&apos;s Dawn Basket
                  </h3>
                  <p className="text-xs text-emerald-200">
                    {cartItemCount} items ready for 6:00 AM delivery
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cartLineItems.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <span className="text-5xl block">🧺</span>
                  <p className="text-base font-bold text-gray-800">Your basket is empty</p>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    Add fresh vegetables and fruits to schedule tomorrow morning&apos;s doorstep delivery.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-3 px-5 py-2.5 bg-emerald-700 text-white text-xs font-bold rounded-2xl"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <>
                  {/* Delivery Location Check */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                        Delivery Destination
                      </span>
                      <p className="text-xs font-bold text-gray-900 mt-0.5">
                        {activeAddress ? `${activeAddress.blockBuilding}, ${activeAddress.flatNumber}` : 'No address selected'}
                      </p>
                      <p className="text-[11px] text-gray-600">
                        {activeAddress ? activeAddress.addressLine : 'Please set address to confirm serviceability'}
                      </p>
                    </div>
                    <button
                      onClick={onOpenLocation}
                      className="text-xs font-bold text-emerald-700 hover:underline shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  {/* Delivery Slot Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      Choose Morning Delivery Slot:
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {slots.map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <div
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">{slot.title}</span>
                              <span className="text-xs font-extrabold text-emerald-800">{slot.timeRange}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">{slot.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-gray-700">
                      Produce Items ({cartLineItems.length}):
                    </label>
                    {cartLineItems.map((ci) => (
                      <div
                        key={ci.productId}
                        className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200"
                      >
                        <img
                          src={ci.product.imageUrl}
                          alt={ci.product.nameEn}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-gray-900 truncate">
                            {ci.product.nameEn}
                          </h5>
                          <p className="text-[11px] text-gray-500">
                            {ci.product.unit} • ₹{ci.product.price} each
                          </p>
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center bg-white border border-gray-300 rounded-xl">
                          <button
                            onClick={() => updateQuantity(ci.productId, -1, ci.product.nameEn)}
                            className="w-7 h-7 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-l-xl"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-gray-900">
                            {ci.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(ci.productId, 1, ci.product.nameEn)}
                            className="w-7 h-7 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-r-xl"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-xs font-extrabold text-gray-900 w-12 text-right">
                          ₹{ci.itemTotal}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Notes */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Delivery Instructions (Optional):
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Leave with guard / Ring bell"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="pt-2 space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      Payment Method:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('COD')}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          paymentMethod === 'COD'
                            ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600'
                            : 'border-gray-200'
                        }`}
                      >
                        <span className="text-xs font-bold block">💵 Cash on Delivery</span>
                        <span className="text-[10px] text-gray-500">Pay upon doorstep receipt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('ONLINE_RAZORPAY')}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          paymentMethod === 'ONLINE_RAZORPAY'
                            ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600'
                            : 'border-gray-200'
                        }`}
                      >
                        <span className="text-xs font-bold block">📱 UPI / Online</span>
                        <span className="text-[10px] text-gray-500">GPay, PhonePe, Cards</span>
                      </button>
                    </div>
                  </div>

                  {/* Cut-off notice: after the zone cut-off an order counts for the next day */}
                  {activeZone?.cutoffTime && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      ⏰ Orders placed after {activeZone.cutoffTime} are treated as the next day&apos;s order.
                    </p>
                  )}

                  {/* Coupon */}
                  <div className="space-y-1.5">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2 text-xs">
                        <span className="text-emerald-800">
                          🎟️ <strong>{appliedCoupon.code}</strong> applied
                          {appliedCoupon.description ? ` • ${appliedCoupon.description}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAppliedCoupon(null)}
                          className="text-red-600 font-bold hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="Have a coupon code?"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={isCheckingCoupon || !couponInput.trim()}
                          className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                        >
                          {isCheckingCoupon ? '...' : 'Apply'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-200 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Item Total:</span>
                      <span>₹{cartSubtotal}</span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Coupon discount ({appliedCoupon?.code}):</span>
                        <span>-₹{couponDiscount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery Fee:</span>
                      <span>{isDeliveryFree ? <strong className="text-emerald-700 font-bold">FREE</strong> : `₹${deliveryFee}`}</span>
                    </div>
                    {cartSavings > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Total Savings (Mandi direct):</span>
                        <span>-₹{cartSavings}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-200 flex justify-between font-black text-sm text-gray-900">
                      <span>Grand Total:</span>
                      <span>₹{grandTotal}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Cart Footer */}
            {cartLineItems.length > 0 && (
              <div className="p-4 bg-white border-t border-gray-200 space-y-2">
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-between"
                >
                  <span>Place Order • ₹{grandTotal}</span>
                  <span>Confirm →</span>
                </button>
                <p className="text-[10px] text-center text-gray-500">
                  🔒 Safe & Hygienic Delivery • Zero Artificial Ripening Guarantee
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ORDER CONFIRMATION MODAL */}
      {orderConfirmed && (
        <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-5 border border-emerald-200 shadow-2xl">
            <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center text-3xl text-emerald-800 animate-bounce">
              ✓
            </div>
            <div>
              <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Order Confirmed
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 mt-2">
                ताज़ी टोकरी ऑर्डर प्राप्त हुआ!
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Order <strong className="text-gray-900">#{orderConfirmed.orderNumber}</strong> has been logged for tomorrow&apos;s dawn farm harvest.
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 text-left text-xs space-y-2 border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Order day:</span>
                <span className="font-bold text-gray-900">{orderConfirmed.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Slot:</span>
                <span className="font-bold text-gray-900">{orderConfirmed.deliverySlot.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Address:</span>
                <span className="font-bold text-gray-900 truncate max-w-[200px]">
                  {orderConfirmed.deliveryAddress.blockBuilding}, {orderConfirmed.deliveryAddress.flatNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Items:</span>
                <span className="font-bold text-gray-900">{orderConfirmed.items.length} produce varieties</span>
              </div>
              {orderConfirmed.discountTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Coupon {orderConfirmed.couponCode}:</span>
                  <span className="font-bold text-emerald-700">-₹{orderConfirmed.discountTotal}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Payment:</span>
                <span className="font-bold text-emerald-800">
                  {orderConfirmed.paymentMethod === 'COD' ? 'Cash on Delivery (₹' + orderConfirmed.grandTotal + ')' : 'Paid Online'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setOrderConfirmed(null)}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xl shadow-md transition-all"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* ORDER HISTORY & TRACKING MODAL */}
      {currentUser && isOrdersOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-fadeIn">
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#072917] px-6 py-4 text-white flex items-center justify-between border-b border-[#14482a]">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <div>
                  <h3 className="text-base font-bold text-white">Your Orders & Deliveries</h3>
                  <p className="text-xs text-emerald-200">Track morning harvest and delivery status</p>
                </div>
              </div>
              <button
                onClick={() => setIsOrdersOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>

            {/* Orders List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl block mb-2">📋</span>
                  <p className="font-bold">No orders placed yet.</p>
                </div>
              ) : (
                orders.map((ord) => {
                  return (
                    <div
                      key={ord.id}
                      className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-gray-900 block">
                            #{ord.orderNumber}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Placed on {new Date(ord.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                            ord.orderStatus === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : ord.orderStatus === 'CANCELLED'
                              ? 'bg-red-100 text-red-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {ord.orderStatus}
                        </span>
                      </div>

                      {/* Visual Stepper */}
                      <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold text-gray-500 pt-1">
                        <div className={`p-1 rounded-lg ${['PLACED', 'CONFIRMED', 'PACKED', 'DELIVERED'].includes(ord.orderStatus) ? 'bg-emerald-700 text-white' : 'bg-gray-200'}`}>
                          1. Placed
                        </div>
                        <div className={`p-1 rounded-lg ${['CONFIRMED', 'PACKED', 'DELIVERED'].includes(ord.orderStatus) ? 'bg-emerald-700 text-white' : 'bg-gray-200'}`}>
                          2. Dawn Mandi
                        </div>
                        <div className={`p-1 rounded-lg ${['PACKED', 'DELIVERED'].includes(ord.orderStatus) ? 'bg-emerald-700 text-white' : 'bg-gray-200'}`}>
                          3. Packed
                        </div>
                        <div className={`p-1 rounded-lg ${ord.orderStatus === 'DELIVERED' ? 'bg-emerald-700 text-white' : 'bg-gray-200'}`}>
                          4. Delivered
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="text-xs text-gray-700 divide-y divide-gray-100 pt-1">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span>{it.quantity} × {it.nameEn}</span>
                            <span className="font-bold">₹{it.itemTotal}</span>
                          </div>
                        ))}
                      </div>
                      {ord.discountTotal > 0 && (
                        <p className="text-[11px] text-emerald-700 font-bold">
                          Coupon {ord.couponCode}: -₹{ord.discountTotal}
                        </p>
                      )}

                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
                        <span className="text-gray-500">
                          {ord.deliverySlot.title} • {ord.paymentMethod}
                        </span>
                        <span className="font-black text-gray-900">
                          Grand Total: ₹{ord.grandTotal}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-[#031d10] text-[#8bba9b] border-t border-[#124b2f] py-8 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <TaaziTokariEmblem size={36} />
            <div>
              <p className="text-sm font-bold text-white">Taazi Tokari — ताज़ी टोकरी</p>
              <p className="text-xs text-[#8bba9b]">Farm-to-Kitchen Society Produce • Lucknow Pilot</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <button onClick={() => setSelectedCategorySlug('vegetables')} className="hover:text-white transition-colors">
              Vegetables
            </button>
            <button onClick={() => setSelectedCategorySlug('fruits')} className="hover:text-white transition-colors">
              Fruits
            </button>
            <button onClick={() => setSelectedCategorySlug('daily-essentials')} className="hover:text-white transition-colors">
              Daily Essentials
            </button>
            <button onClick={onOpenLocation} className="hover:text-white transition-colors">
              Delivery Zones
            </button>
            {currentUser?.role === 'admin' && onSwitchToAdmin && (
              <button onClick={onSwitchToAdmin} className="text-[#f4a62a] hover:underline font-bold">
                Admin Control Center
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#527d63]">© 2026 Taazi Tokari Technologies Pvt Ltd. Lucknow (#LKO-24).</p>
        </div>
      </footer>
    </div>
  );
};
