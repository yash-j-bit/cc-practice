import { z } from "zod";
import { getClient, withTransaction } from "../db/client.js";
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { parse } from "../utils/validation.js";

export interface StockLot {
  id: number;
  product_id: number;
  warehouse_id: number;
  lot_number: string;
  quantity: number;
  expiry_date: string | null;
  received_at: string;
}

export interface LotOutboundResult {
  consumed: { lot_id: number; lot_number: string; quantity: number }[];
  total_consumed: number;
}

export interface ExpiryAlert {
  lot_number: string;
  sku: string;
  warehouse: string;
  quantity: number;
  expiry_date: string;
  days_remaining: number;
}

const lotInSchema = z.object({
  sku: z.string().min(1),
  warehouse: z.string().min(1),
  lot_number: z.string().min(1),
  quantity: z.number().int().positive("quantity must be > 0"),
  expiry_date: z.string().optional(),
});

export type LotInInput = z.infer<typeof lotInSchema>;

async function resolveProductId(sku: string): Promise<number> {
  const db = getClient();
  const res = await db.execute({
    sql: "SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL",
    args: [sku],
  });
  if (res.rows.length === 0) throw new NotFoundError("product", sku);
  return Number(res.rows[0].id);
}

async function resolveWarehouseId(name: string): Promise<number> {
  const db = getClient();
  const res = await db.execute({
    sql: "SELECT id FROM warehouses WHERE name = ?",
    args: [name],
  });
  if (res.rows.length === 0) throw new NotFoundError("warehouse", name);
  return Number(res.rows[0].id);
}

/**
 * Receive a lot into the warehouse.
 */
export async function lotIn(input: LotInInput): Promise<StockLot> {
  const data = parse(lotInSchema, input);
  const productId = await resolveProductId(data.sku);
  const warehouseId = await resolveWarehouseId(data.warehouse);
  const db = getClient();

  const res = await db.execute({
    sql: `INSERT INTO stock_lots (product_id, warehouse_id, lot_number, quantity, expiry_date)
          VALUES (?, ?, ?, ?, ?)`,
    args: [productId, warehouseId, data.lot_number, data.quantity, data.expiry_date ?? null],
  });

  const id = Number(res.lastInsertRowid);
  logger.info("lot received", { lot: data.lot_number, qty: data.quantity });

  const row = await db.execute({
    sql: "SELECT * FROM stock_lots WHERE id = ?",
    args: [id],
  });
  const r = row.rows[0];
  return {
    id: Number(r.id),
    product_id: Number(r.product_id),
    warehouse_id: Number(r.warehouse_id),
    lot_number: String(r.lot_number),
    quantity: Number(r.quantity),
    expiry_date: r.expiry_date == null ? null : String(r.expiry_date),
    received_at: String(r.received_at),
  };
}

/**
 * FIFO outbound: consume from the oldest lots first.
 * Uses a transaction to ensure atomicity across multiple lots.
 */
export async function lotOutFifo(
  sku: string,
  warehouse: string,
  quantity: number,
): Promise<LotOutboundResult> {
  if (quantity <= 0) throw new ValidationError("quantity must be > 0");
  const productId = await resolveProductId(sku);
  const warehouseId = await resolveWarehouseId(warehouse);

  return withTransaction(async (db) => {
    // Get lots ordered by received_at (FIFO)
    const lotsRes = await db.execute({
      sql: `SELECT id, lot_number, quantity FROM stock_lots
            WHERE product_id = ? AND warehouse_id = ? AND quantity > 0
            ORDER BY received_at ASC`,
      args: [productId, warehouseId],
    });

    const totalAvailable = lotsRes.rows.reduce(
      (sum, r) => sum + Number(r.quantity),
      0,
    );
    if (totalAvailable < quantity) {
      throw new InsufficientStockError(totalAvailable, quantity);
    }

    let remaining = quantity;
    const consumed: LotOutboundResult["consumed"] = [];

    for (const row of lotsRes.rows) {
      if (remaining <= 0) break;
      const lotId = Number(row.id);
      const lotQty = Number(row.quantity);
      const lotNumber = String(row.lot_number);
      const take = Math.min(lotQty, remaining);

      await db.execute({
        sql: "UPDATE stock_lots SET quantity = quantity - ? WHERE id = ?",
        args: [take, lotId],
      });

      consumed.push({ lot_id: lotId, lot_number: lotNumber, quantity: take });
      remaining -= take;
    }

    logger.info("lot FIFO outbound", { sku, qty: quantity, lots: consumed.length });
    return { consumed, total_consumed: quantity };
  });
}

/**
 * Get all lots for a product in a warehouse.
 */
export async function getLots(
  sku: string,
  warehouse: string,
): Promise<StockLot[]> {
  const productId = await resolveProductId(sku);
  const warehouseId = await resolveWarehouseId(warehouse);
  const db = getClient();

  const res = await db.execute({
    sql: `SELECT * FROM stock_lots
          WHERE product_id = ? AND warehouse_id = ? AND quantity > 0
          ORDER BY received_at ASC`,
    args: [productId, warehouseId],
  });

  return res.rows.map((r) => ({
    id: Number(r.id),
    product_id: Number(r.product_id),
    warehouse_id: Number(r.warehouse_id),
    lot_number: String(r.lot_number),
    quantity: Number(r.quantity),
    expiry_date: r.expiry_date == null ? null : String(r.expiry_date),
    received_at: String(r.received_at),
  }));
}

/**
 * Get lots expiring within the specified number of days.
 */
export async function getExpiryAlerts(
  daysAhead: number = 30,
): Promise<ExpiryAlert[]> {
  const db = getClient();
  const res = await db.execute({
    sql: `SELECT sl.lot_number, p.sku, w.name AS warehouse,
                 sl.quantity, sl.expiry_date,
                 CAST(julianday(sl.expiry_date) - julianday('now') AS INTEGER) AS days_remaining
          FROM stock_lots sl
          JOIN products p ON p.id = sl.product_id AND p.deleted_at IS NULL
          JOIN warehouses w ON w.id = sl.warehouse_id
          WHERE sl.expiry_date IS NOT NULL
            AND sl.quantity > 0
            AND julianday(sl.expiry_date) - julianday('now') <= ?
            AND julianday(sl.expiry_date) - julianday('now') >= 0
          ORDER BY sl.expiry_date ASC`,
    args: [daysAhead],
  });

  return res.rows.map((r) => ({
    lot_number: String(r.lot_number),
    sku: String(r.sku),
    warehouse: String(r.warehouse),
    quantity: Number(r.quantity),
    expiry_date: String(r.expiry_date),
    days_remaining: Number(r.days_remaining),
  }));
}
