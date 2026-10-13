// ==============================================================================
// TAAZI TOKARI - OPERATIONS PORTAL
// For operations staff (logins created by an admin). They can move orders through
// their statuses and look at stock. Nothing financial is shown; the API enforces this too.
// ==============================================================================

import React, { useState } from 'react';
import { appStore, CustomerOrder, OrderStatus, UserProfile } from '../../services/store';
import { TaaziTokariEmblem } from '../BrandLogo';

const STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

interface OpsPortalProps {
  currentUser: UserProfile;
  onSignOut: () => void;
}

export const OpsPortal: React.FC<OpsPortalProps> = ({ currentUser, onSignOut }) => {
  const [section, setSection] = useState<'orders' | 'stock'>('orders');
  const [orders, setOrders] = useState<CustomerOrder[]>(appStore.getOrders());
  const [dayFilter, setDayFilter] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const changeStatus = async (order: CustomerOrder, status: OrderStatus) => {
    try {
      await appStore.updateOrderStatus(order.id, status);
      setOrders(appStore.getOrders());
      showToast(`${order.orderNumber} → ${status}`);
    } catch (err: any) {
      showToast(err.message || 'Could not update the order.');
    }
  };

  const products = appStore.getProducts();
  const movements = appStore.getInventoryMovements();
  const visibleOrders = dayFilter ? orders.filter((o) => o.orderDate === dayFilter) : orders;

  return (
    <div className="min-h-screen bg-[#f2fcf1]">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#072917] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <header className="bg-[#072917] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TaaziTokariEmblem size={34} />
          <div>
            <h1 className="text-sm font-bold">Operations Console</h1>
            <p className="text-[11px] text-emerald-200">{currentUser.fullName || currentUser.email}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl">
          Sign Out
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          {(
            [
              ['orders', '🛍️ Orders'],
              ['stock', '📦 Stock'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold ${
                section === id ? 'bg-emerald-700 text-white' : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {section === 'orders' && (
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">Orders ({visibleOrders.length})</h2>
              <label className="text-xs text-gray-600 flex items-center gap-2">
                Order day
                <input
                  type="date"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="border rounded-lg px-2 py-1"
                />
                {dayFilter && (
                  <button onClick={() => setDayFilter('')} className="text-emerald-700 font-bold">
                    Clear
                  </button>
                )}
              </label>
            </div>

            {visibleOrders.length === 0 && <p className="text-xs text-gray-500">No orders.</p>}
            {visibleOrders.map((o) => (
              <div key={o.id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">
                      #{o.orderNumber} · {o.customerName} ({o.customerPhone})
                    </p>
                    <p className="text-gray-500">
                      Order day {o.orderDate} · {o.deliverySlot.title} · {o.paymentMethod}
                    </p>
                    <p className="text-gray-500">
                      {o.deliveryAddress.flatNumber}, {o.deliveryAddress.blockBuilding} {o.deliveryAddress.addressLine}
                    </p>
                  </div>
                  <select
                    value={o.orderStatus}
                    disabled={o.orderStatus === 'CANCELLED'}
                    onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                    className="border rounded-xl px-2 py-1.5 font-bold bg-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-gray-700">
                  {o.items.map((i) => `${i.quantity} × ${i.nameEn} (${i.unit})`).join(', ')}
                </p>
                {o.deliveryNotes && <p className="text-amber-800">Notes: {o.deliveryNotes}</p>}
              </div>
            ))}
          </div>
        )}

        {section === 'stock' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm overflow-x-auto">
              <h2 className="text-base font-bold text-gray-900 mb-3">Current Stock</h2>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Unit</th>
                    <th className="py-2 pr-3">In stock</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = p.stockQty <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-bold text-gray-900">{p.nameEn}</td>
                        <td className="py-2 pr-3 text-gray-500">{p.unit}</td>
                        <td className="py-2 pr-3 font-bold">{p.stockQty}</td>
                        <td className="py-2">
                          <span className={low ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                            {low ? 'Low stock' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm overflow-x-auto">
              <h2 className="text-base font-bold text-gray-900 mb-3">Recent Stock Movements</h2>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Change</th>
                    <th className="py-2 pr-3">Balance</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-gray-500">{new Date(m.timestamp).toLocaleString()}</td>
                      <td className="py-2 pr-3 font-bold text-gray-900">{m.productName}</td>
                      <td className={`py-2 pr-3 font-bold ${m.changeQty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {m.changeQty > 0 ? '+' : ''}
                        {m.changeQty}
                      </td>
                      <td className="py-2 pr-3">{m.balanceQtyAfter}</td>
                      <td className="py-2 text-gray-500">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
