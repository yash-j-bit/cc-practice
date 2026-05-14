import { z } from 'zod';
import { db, nextId, nowIso } from '@/db/store';
import { InventoryRow, MovementType, StockMovement } from '@/db/schema';
import { InsufficientStockError, NotFoundError } from '@/errors';
import { getProduct } from './products';

const movementBaseSchema = z.object({
  productId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  quantity: z.number().int().positive('数量は 1 以上の整数で入力してください'),
  note: z.string().trim().max(500).optional().nullable(),
});

export const receiveSchema = movementBaseSchema;
export const shipSchema = movementBaseSchema;

export type StockMovementInput = z.infer<typeof movementBaseSchema>;

export function listWarehouses() {
  return db().warehouses.slice();
}

function getInventoryRow(productId: number, warehouseId: number): InventoryRow | undefined {
  return db().inventory.find(
    (i) => i.productId === productId && i.warehouseId === warehouseId,
  );
}

function ensureWarehouse(id: number) {
  if (!db().warehouses.find((w) => w.id === id)) {
    throw new NotFoundError('倉庫', id);
  }
}

function applyMovement(
  type: MovementType,
  input: StockMovementInput,
  referenceType: string | null = null,
  referenceId: number | null = null,
): StockMovement {
  const product = getProduct(input.productId);
  ensureWarehouse(input.warehouseId);

  const s = db();
  const row =
    getInventoryRow(input.productId, input.warehouseId) ??
    (() => {
      const created: InventoryRow = {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: 0,
        updatedAt: nowIso(),
      };
      s.inventory.push(created);
      return created;
    })();

  if (type === 'out' && row.quantity < input.quantity) {
    throw new InsufficientStockError(product.name, row.quantity, input.quantity);
  }

  row.quantity += type === 'in' ? input.quantity : -input.quantity;
  row.updatedAt = nowIso();

  const movement: StockMovement = {
    id: nextId('movement'),
    productId: input.productId,
    warehouseId: input.warehouseId,
    type,
    quantity: input.quantity,
    referenceType,
    referenceId,
    note: input.note ?? null,
    createdAt: nowIso(),
  };
  s.movements.push(movement);
  return movement;
}

export function receiveStock(input: StockMovementInput): StockMovement {
  return applyMovement('in', input);
}

export function shipStock(
  input: StockMovementInput,
  referenceType: string | null = null,
  referenceId: number | null = null,
): StockMovement {
  return applyMovement('out', input, referenceType, referenceId);
}

export interface MovementFilter {
  from?: string;
  to?: string;
  productId?: number;
  warehouseId?: number;
  type?: MovementType;
  page?: number;
  pageSize?: number;
}

export function listMovements(filter: MovementFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

  const filtered = db().movements.filter((m) => {
    if (filter.from && m.createdAt < filter.from) return false;
    if (filter.to && m.createdAt > filter.to) return false;
    if (filter.productId !== undefined && m.productId !== filter.productId) return false;
    if (filter.warehouseId !== undefined && m.warehouseId !== filter.warehouseId)
      return false;
    if (filter.type && m.type !== filter.type) return false;
    return true;
  });

  const sorted = filtered
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const start = (page - 1) * pageSize;
  return {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    pageSize,
  };
}

export interface InventoryByProduct {
  productId: number;
  sku: string;
  name: string;
  totalQuantity: number;
  byWarehouse: Array<{ warehouseId: number; warehouseName: string; quantity: number }>;
  minStock: number;
  cost: number;
}

export function inventoryByProduct(): InventoryByProduct[] {
  const s = db();
  return s.products
    .filter((p) => p.deletedAt === null)
    .map((p) => {
      const rows = s.inventory.filter((i) => i.productId === p.id);
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        totalQuantity: rows.reduce((sum, r) => sum + r.quantity, 0),
        byWarehouse: rows.map((r) => ({
          warehouseId: r.warehouseId,
          warehouseName: s.warehouses.find((w) => w.id === r.warehouseId)?.name ?? '不明',
          quantity: r.quantity,
        })),
        minStock: p.minStock,
        cost: p.cost,
      };
    })
    .sort((a, b) => a.productId - b.productId);
}
