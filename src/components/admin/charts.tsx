// Small dependency-free SVG charts and the per-section graph panels for the admin console.

import React, { useMemo } from 'react';
import type { BusinessMetrics } from '../../services/api/admin';
import type {
  CustomerFeedback,
  CustomerOrder,
  ExpenseRecord,
  ManualSaleRecord,
  ProductItem,
  PurchaseRecord,
} from '../../services/store';

export interface Datum {
  label: string;
  value: number;
  color?: string;
}

const PALETTE = ['#047857', '#f4a62a', '#0e7490', '#b45309', '#6d28d9', '#be123c', '#4d7c0f', '#475569'];
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const plain = (n: number) => String(Math.round(n * 100) / 100);

const Empty = () => <p className="text-xs text-gray-400 py-8 text-center">No data for this period</p>;

export const BarChart: React.FC<{ data: Datum[]; format?: (n: number) => string }> = ({ data, format = plain }) => {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <Empty />;
  const W = 480;
  const H = 200;
  const pad = { l: 8, r: 8, t: 18, b: 34 };
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const slot = (W - pad.l - pad.r) / data.length;
  const barW = Math.min(slot * 0.6, 48);
  const base = H - pad.b;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      <line x1={pad.l} x2={W - pad.r} y1={base} y2={base} stroke="#e5e7eb" />
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * (base - pad.t);
        const x = pad.l + slot * i + (slot - barW) / 2;
        return (
          <g key={`${d.label}-${i}`}>
            <title>{`${d.label}: ${format(d.value)}`}</title>
            <rect x={x} y={base - h} width={barW} height={h} rx={4} fill={d.color ?? (d.value < 0 ? '#be123c' : PALETTE[0])} />
            <text x={x + barW / 2} y={base - h - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#374151">
              {format(d.value)}
            </text>
            <text x={x + barW / 2} y={H - 18} textAnchor="middle" fontSize="9" fill="#6b7280">
              {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const LineChart: React.FC<{ data: Datum[]; format?: (n: number) => string }> = ({ data, format = plain }) => {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <Empty />;
  const W = 480;
  const H = 200;
  const pad = { l: 12, r: 12, t: 20, b: 30 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? (W - pad.l - pad.r) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: data.length > 1 ? pad.l + stepX * i : W / 2,
    y: H - pad.b - (d.value / max) * (H - pad.t - pad.b),
    d,
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H - pad.b} ${line} ${pts[pts.length - 1].x},${H - pad.b}`;
  const labelEvery = Math.ceil(data.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#e5e7eb" />
      <polygon points={area} fill="#047857" opacity="0.12" />
      <polyline points={line} fill="none" stroke="#047857" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.d.label}>
          <title>{`${p.d.label}: ${format(p.d.value)}`}</title>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#047857" />
          {i % labelEvery === 0 && (
            <text x={p.x} y={H - 12} textAnchor="middle" fontSize="9" fill="#6b7280">
              {p.d.label}
            </text>
          )}
        </g>
      ))}
      <text x={pts[pts.length - 1].x} y={Math.max(pts[pts.length - 1].y - 8, 10)} textAnchor="end" fontSize="9" fontWeight="700" fill="#374151">
        {format(pts[pts.length - 1].d.value)}
      </text>
    </svg>
  );
};

export const DonutChart: React.FC<{ data: Datum[] }> = ({ data }) => {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Empty />;
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" role="img">
        <g transform="rotate(-90 80 80)">
          {slices.map((d, i) => {
            const len = (d.value / total) * C;
            const el = (
              <circle
                key={d.label}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={d.color ?? PALETTE[i % PALETTE.length]}
                strokeWidth="24"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${plain(d.value)}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="80" y="85" textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">
          {plain(total)}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {slices.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color ?? PALETTE[i % PALETTE.length] }} />
            <span className="text-gray-700">{d.label}</span>
            <span className="font-bold text-gray-900">{plain(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-2">
    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h4>
    {children}
  </div>
);

// --- Data helpers -----------------------------------------------------------------------

// The last `days` calendar days ending today, as YYYY-MM-DD (local time).
const lastDays = (days: number): string[] => {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
};

const dailyTotals = <T,>(days: string[], rows: T[], dateOf: (r: T) => string, valueOf: (r: T) => number): Datum[] => {
  const sums = new Map<string, number>(days.map((d) => [d, 0]));
  rows.forEach((r) => {
    const key = dateOf(r).slice(0, 10);
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + valueOf(r));
  });
  return days.map((d) => ({ label: d.slice(5), value: sums.get(d) ?? 0 }));
};

const countBy = <T,>(rows: T[], keyOf: (r: T) => string): Datum[] => {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1));
  return [...counts].map(([label, value]) => ({ label, value }));
};

const STATUS_COLORS: Record<string, string> = {
  PLACED: '#0e7490',
  CONFIRMED: '#6d28d9',
  PACKED: '#f4a62a',
  OUT_FOR_DELIVERY: '#b45309',
  DELIVERED: '#047857',
  CANCELLED: '#be123c',
};

export const GRAPH_SECTIONS = ['dashboard', 'orders', 'inventory', 'products', 'purchases', 'sales', 'expenses', 'feedback'];

interface AdminGraphsProps {
  section: string;
  metrics: BusinessMetrics;
  orders: CustomerOrder[];
  products: ProductItem[];
  purchases: PurchaseRecord[];
  manualSales: ManualSaleRecord[];
  expenses: ExpenseRecord[];
  feedback: CustomerFeedback[];
}

export const AdminGraphs: React.FC<AdminGraphsProps> = ({
  section,
  metrics,
  orders,
  products,
  purchases,
  manualSales,
  expenses,
  feedback,
}) => {
  const live = useMemo(() => orders.filter((o) => o.orderStatus !== 'CANCELLED'), [orders]);

  const statusData = useMemo(
    () => countBy(orders, (o) => o.orderStatus).map((d) => ({ ...d, color: STATUS_COLORS[d.label] })),
    [orders]
  );

  const salesDaily = useMemo(() => {
    const days = lastDays(7);
    const online = dailyTotals(days, live, (o) => o.orderDate, (o) => o.grandTotal);
    const manual = dailyTotals(days, manualSales, (s) => s.date, (s) => s.totalRevenue);
    return online.map((d, i) => ({ label: d.label, value: d.value + manual[i].value }));
  }, [live, manualSales]);

  const topProducts = useMemo(() => {
    const units = new Map<string, number>();
    live.forEach((o) => o.items.forEach((it) => units.set(it.nameEn, (units.get(it.nameEn) ?? 0) + it.quantity)));
    return [...units]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [live]);

  const slotData = useMemo(() => countBy(orders, (o) => o.deliverySlot.title), [orders]);

  const lowestStock = useMemo(
    () =>
      [...products]
        .sort((a, b) => a.stockQty - b.stockQty)
        .slice(0, 10)
        .map((p) => ({
          label: p.nameEn,
          value: p.stockQty,
          color: p.stockQty <= p.lowStockThreshold ? '#f4a62a' : '#047857',
        })),
    [products]
  );

  const days14 = useMemo(() => lastDays(14), []);

  if (section === 'dashboard') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`Money flow for ${metrics.targetDate}`}>
          <BarChart
            format={rupees}
            data={[
              { label: 'Revenue', value: metrics.totalSalesRevenue },
              { label: 'Purchases', value: metrics.totalPurchaseSpending, color: '#b45309' },
              { label: 'Expenses', value: metrics.totalOperatingExpenses, color: '#475569' },
              { label: 'Gross profit', value: metrics.estimatedGrossProfit, color: '#0e7490' },
              { label: 'Net profit', value: metrics.estimatedNetOperatingProfit, color: '#6d28d9' },
            ]}
          />
        </Card>
        <Card title="Sales, last 7 days">
          <LineChart data={salesDaily} format={rupees} />
        </Card>
        <Card title="Orders by status">
          <DonutChart data={statusData} />
        </Card>
        <Card title="Top 5 products (units ordered)">
          <BarChart data={topProducts} />
        </Card>
      </div>
    );
  }

  if (section === 'orders') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Orders by status">
          <DonutChart data={statusData} />
        </Card>
        <Card title="Orders by delivery slot">
          <BarChart data={slotData} />
        </Card>
        <Card title="Order value, last 14 days">
          <LineChart data={dailyTotals(days14, live, (o) => o.orderDate, (o) => o.grandTotal)} format={rupees} />
        </Card>
      </div>
    );
  }

  if (section === 'inventory' || section === 'products') {
    return (
      <Card title="Lowest stock (amber = at or below alert level)">
        <BarChart data={lowestStock} />
      </Card>
    );
  }

  if (section === 'purchases') {
    return (
      <Card title="Purchase spending, last 14 days">
        <LineChart data={dailyTotals(days14, purchases, (p) => p.date, (p) => p.totalCost)} format={rupees} />
      </Card>
    );
  }

  if (section === 'sales') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Manual sales, last 14 days">
          <LineChart data={dailyTotals(days14, manualSales, (s) => s.date, (s) => s.totalRevenue)} format={rupees} />
        </Card>
        <Card title="All sales, last 7 days">
          <LineChart data={salesDaily} format={rupees} />
        </Card>
      </div>
    );
  }

  if (section === 'expenses') {
    const byCategory = new Map<string, number>();
    expenses.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount));
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Expenses, last 14 days">
          <LineChart data={dailyTotals(days14, expenses, (e) => e.date, (e) => e.amount)} format={rupees} />
        </Card>
        <Card title="Expenses by category (₹)">
          <DonutChart data={[...byCategory].map(([label, value]) => ({ label, value }))} />
        </Card>
      </div>
    );
  }

  if (section === 'feedback') {
    return (
      <Card title="Rating distribution">
        <BarChart
          data={[1, 2, 3, 4, 5].map((star) => ({
            label: `${star} ★`,
            value: feedback.filter((f) => f.rating === star).length,
          }))}
        />
      </Card>
    );
  }

  return null;
};
