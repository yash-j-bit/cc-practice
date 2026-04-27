import { z } from "zod";
import { getClient, withTransaction } from "../db/client.js";
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { parse } from "../utils/validation.js";

export interface InventoryRow {
  product_id: number;
  warehouse_id: number;
  quantity: number;
}

export interface StockStatus {
  sku: string;
  product_name: string;
  warehouse: string;
  quantity: number;
}

const movementSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive("quantity must be > 0"),
  warehouse: z.string().min(1),
  note: z.string().optional(),
  reference_type: z.string().optional(),
  reference_id: z.number().int().optional(),
});

export type StockMovementInput = z.infer<typeof movementSchema>;

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

async function getInventoryRow(
  productId: number,
  warehouseId: number,
): Promise<InventoryRow | null> {
  const db = getClient();
  const res = await db.execute({
    sql: "SELECT product_id, warehouse_id, quantity FROM inventory WHERE product_id = ? AND warehouse_id = ?",
    args: [productId, warehouseId],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    product_id: Number(row.product_id),
    warehouse_id: Number(row.warehouse_id),
    quantity: Number(row.quantity),
  };
}

export async function stockIn(input: StockMovementInput): Promise<InventoryRow> {
  const data = parse(movementSchema, input);
  const productId = await resolveProductId(data.sku);
  const warehouseId = await resolveWarehouseId(data.warehouse);

  await withTransaction(async (db) => {
    const existing = await getInventoryRow(productId, warehouseId);
    if (existing) {
      await db.execute({
        sql: "UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND warehouse_id = ?",
        args: [data.quantity, productId, warehouseId],
      });
    } else {
      await db.execute({
        sql: "INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)",
        args: [productId, warehouseId, data.quantity],
      });
    }
    await db.execute({
      sql: `INSERT INTO stock_movements
            (product_id, warehouse_id, type, quantity, reference_type, reference_id, note)
            VALUES (?, ?, 'in', ?, ?, ?, ?)`,
      args: [
        productId,
        warehouseId,
        data.quantity,
        data.reference_type ?? null,
        data.reference_id ?? null,
        data.note ?? null,
      ],
    });
  });

  logger.info("stock in", { sku: data.sku, quantity: data.quantity });
  const row = await getInventoryRow(productId, warehouseId);
  if (!row) throw new Error("inventory row missing after stockIn");
  return row;
}

export async function stockOut(input: StockMovementInput): Promise<InventoryRow> {
  const data = parse(movementSchema, input);
  const productId = await resolveProductId(data.sku);
  const warehouseId = await resolveWarehouseId(data.warehouse);

  await withTransaction(async (db) => {
    const existing = await getInventoryRow(productId, warehouseId);
    const available = existing?.quantity ?? 0;
    if (available < data.quantity) {
      throw new InsufficientStockError(available, data.quantity);
    }
    await db.execute({
      sql: "UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ? AND warehouse_id = ?",
      args: [data.quantity, productId, warehouseId],
    });
    await db.execute({
      sql: `INSERT INTO stock_movements
            (product_id, warehouse_id, type, quantity, reference_type, reference_id, note)
            VALUES (?, ?, 'out', ?, ?, ?, ?)`,
      args: [
        productId,
        warehouseId,
        data.quantity,
        data.reference_type ?? null,
        data.reference_id ?? null,
        data.note ?? null,
      ],
    });
  });

  logger.info("stock out", { sku: data.sku, quantity: data.quantity });
  const row = await getInventoryRow(productId, warehouseId);
  if (!row) throw new Error("inventory row missing after stockOut");
  return row;
}

const transferSchema = z.object({
  sku: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  quantity: z.number().int().positive("quantity must be > 0"),
  note: z.string().optional(),
});

export type StockTransferInput = z.infer<typeof transferSchema>;

export interface TransferResult {
  from: { warehouse: string; quantity: number };
  to: { warehouse: string; quantity: number };
}

export async function addWarehouse(
  name: string,
  location?: string,
): Promise<{ id: number; name: string }> {
  if (!name.trim()) {
    throw new ValidationError("warehouse name is required");
  }
  const db = getClient();
  const existing = await db.execute({
    sql: "SELECT id FROM warehouses WHERE name = ?",
    args: [name],
  });
  if (existing.rows.length > 0) {
    return { id: Number(existing.rows[0].id), name };
  }
  const res = await db.execute({
    sql: "INSERT INTO warehouses (name, location) VALUES (?, ?)",
    args: [name, location ?? null],
  });
  return { id: Number(res.lastInsertRowid), name };
}

export async function stockTransfer(
  input: StockTransferInput,
): Promise<TransferResult> {
  const data = parse(transferSchema, input);
  if (data.from === data.to) {
    throw new ValidationError("from and to must differ");
  }
  const productId = await resolveProductId(data.sku);
  const fromId = await resolveWarehouseId(data.from);
  const toId = await resolveWarehouseId(data.to);

  await withTransaction(async (db) => {
    const fromRow = await getInventoryRow(productId, fromId);
    const available = fromRow?.quantity ?? 0;
    if (available < data.quantity) {
      throw new InsufficientStockError(available, data.quantity);
    }

    await db.execute({
      sql: "UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ? AND warehouse_id = ?",
      args: [data.quantity, productId, fromId],
    });

    const toRow = await getInventoryRow(productId, toId);
    if (toRow) {
      await db.execute({
        sql: "UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND warehouse_id = ?",
        args: [data.quantity, productId, toId],
      });
    } else {
      await db.execute({
        sql: "INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)",
        args: [productId, toId, data.quantity],
      });
    }

    await db.execute({
      sql: `INSERT INTO stock_movements
            (product_id, warehouse_id, type, quantity, reference_type, note)
            VALUES (?, ?, 'out', ?, 'transfer', ?)`,
      args: [productId, fromId, data.quantity, data.note ?? null],
    });
    await db.execute({
      sql: `INSERT INTO stock_movements
            (product_id, warehouse_id, type, quantity, reference_type, note)
            VALUES (?, ?, 'in', ?, 'transfer', ?)`,
      args: [productId, toId, data.quantity, data.note ?? null],
    });
  });

  logger.info("stock transfer", {
    sku: data.sku,
    from: data.from,
    to: data.to,
    qty: data.quantity,
  });

  const fromFinal = (await getInventoryRow(productId, fromId))?.quantity ?? 0;
  const toFinal = (await getInventoryRow(productId, toId))?.quantity ?? 0;
  return {
    from: { warehouse: data.from, quantity: fromFinal },
    to: { warehouse: data.to, quantity: toFinal },
  };
}

export interface StockStatusOptions {
  sku?: string;
  warehouse?: string;
}

export async function getStockStatus(
  opts: StockStatusOptions = {},
): Promise<StockStatus[]> {
  const db = getClient();
  const conditions: string[] = ["p.deleted_at IS NULL"];
  const args: (string | number)[] = [];
  if (opts.sku) {
    conditions.push("p.sku = ?");
    args.push(opts.sku);
  }
  if (opts.warehouse) {
    conditions.push("w.name = ?");
    args.push(opts.warehouse);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const res = await db.execute({
    sql: `SELECT p.sku AS sku, p.name AS product_name, w.name AS warehouse, i.quantity AS quantity
          FROM inventory i
          JOIN products p ON p.id = i.product_id
          JOIN warehouses w ON w.id = i.warehouse_id
          ${where}
          ORDER BY p.sku, w.name`,
    args,
  });
  return res.rows.map((r) => ({
    sku: String(r.sku),
    product_name: String(r.product_name),
    warehouse: String(r.warehouse),
    quantity: Number(r.quantity),
  }));
}
