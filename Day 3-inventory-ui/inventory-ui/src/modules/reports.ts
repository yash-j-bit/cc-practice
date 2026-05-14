import { db } from '@/db/store';
import { inventoryByProduct } from './stock';

function startOfDayUTC(d: Date): string {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return c.toISOString();
}

export function dailySales(from?: string, to?: string) {
  const s = db();
  const fromIso = from ?? new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const toIso = to ?? new Date().toISOString();

  // Bucket by day (UTC).
  const buckets: Record<string, { date: string; total: number; orderCount: number }> = {};

  // Pre-fill 7 days when defaults used.
  const start = new Date(fromIso);
  const end = new Date(toIso);
  for (
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, total: 0, orderCount: 0 };
  }

  s.orders
    .filter((o) => o.status !== 'cancelled')
    .filter((o) => o.createdAt >= fromIso && o.createdAt <= toIso)
    .forEach((o) => {
      const key = o.createdAt.slice(0, 10);
      if (!buckets[key]) buckets[key] = { date: key, total: 0, orderCount: 0 };
      buckets[key].total += o.totalAmount;
      buckets[key].orderCount += 1;
    });

  return Object.values(buckets).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function salesByProduct(from?: string, to?: string) {
  const s = db();
  const fromIso = from ?? new Date(0).toISOString();
  const toIso = to ?? new Date().toISOString();
  const ordersInRange = new Set(
    s.orders
      .filter((o) => o.status !== 'cancelled')
      .filter((o) => o.createdAt >= fromIso && o.createdAt <= toIso)
      .map((o) => o.id),
  );

  const map = new Map<
    number,
    { productId: number; sku: string; name: string; quantity: number; revenue: number }
  >();
  s.orderItems
    .filter((it) => ordersInRange.has(it.orderId))
    .forEach((it) => {
      const prod = s.products.find((p) => p.id === it.productId);
      const entry = map.get(it.productId) ?? {
        productId: it.productId,
        sku: prod?.sku ?? '-',
        name: prod?.name ?? '(削除済み)',
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += it.quantity;
      entry.revenue += it.subtotal;
      map.set(it.productId, entry);
    });

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function inventoryValuation() {
  const rows = inventoryByProduct().map((row) => ({
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    quantity: row.totalQuantity,
    cost: row.cost,
    valuation: row.totalQuantity * row.cost,
  }));
  const total = rows.reduce((sum, r) => sum + r.valuation, 0);
  return { rows, total };
}

export function dashboardSummary() {
  const s = db();
  const products = s.products.filter((p) => p.deletedAt === null);
  const valuation = inventoryValuation();
  const totalQuantity = valuation.rows.reduce((sum, r) => sum + r.quantity, 0);
  return {
    productCount: products.length,
    totalQuantity,
    inventoryValue: valuation.total,
  };
}

export function recentMovements(limit = 10) {
  const s = db();
  return s.movements
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((m) => {
      const product = s.products.find((p) => p.id === m.productId);
      const warehouse = s.warehouses.find((w) => w.id === m.warehouseId);
      return {
        id: m.id,
        createdAt: m.createdAt,
        productName: product?.name ?? '-',
        sku: product?.sku ?? '-',
        warehouseName: warehouse?.name ?? '-',
        type: m.type,
        quantity: m.quantity,
      };
    });
}

export function lowStockAlerts() {
  return inventoryByProduct()
    .filter((row) => row.totalQuantity < row.minStock)
    .map((row) => ({
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      quantity: row.totalQuantity,
      minStock: row.minStock,
      shortage: row.minStock - row.totalQuantity,
    }))
    .sort((a, b) => b.shortage - a.shortage);
}

export function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  });
  return lines.join('\n');
}

// startOfDayUTC kept for future grouping by month etc.
export { startOfDayUTC };
