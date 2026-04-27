import { z } from "zod";
import { getClient } from "../db/client.js";
import { NotFoundError } from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { parse } from "../utils/validation.js";

export interface StockThreshold {
  sku: string;
  warehouse: string;
  min_quantity: number;
}

export interface StockAlert {
  sku: string;
  product_name: string;
  warehouse: string;
  current: number;
  minimum: number;
}

const setThresholdSchema = z.object({
  sku: z.string().min(1),
  warehouse: z.string().min(1),
  min_quantity: z.number().int().nonnegative("min_quantity must be >= 0"),
});

export type SetThresholdInput = z.infer<typeof setThresholdSchema>;

async function resolveIds(
  sku: string,
  warehouse: string,
): Promise<{ product_id: number; warehouse_id: number }> {
  const db = getClient();
  const pRes = await db.execute({
    sql: "SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL",
    args: [sku],
  });
  if (pRes.rows.length === 0) throw new NotFoundError("product", sku);
  const wRes = await db.execute({
    sql: "SELECT id FROM warehouses WHERE name = ?",
    args: [warehouse],
  });
  if (wRes.rows.length === 0) throw new NotFoundError("warehouse", warehouse);
  return {
    product_id: Number(pRes.rows[0].id),
    warehouse_id: Number(wRes.rows[0].id),
  };
}

export async function setThreshold(
  input: SetThresholdInput,
): Promise<StockThreshold> {
  const data = parse(setThresholdSchema, input);
  const { product_id, warehouse_id } = await resolveIds(
    data.sku,
    data.warehouse,
  );
  const db = getClient();
  await db.execute({
    sql: `INSERT INTO stock_thresholds (product_id, warehouse_id, min_quantity)
          VALUES (?, ?, ?)
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET min_quantity = excluded.min_quantity,
                        updated_at = datetime('now')`,
    args: [product_id, warehouse_id, data.min_quantity],
  });
  logger.info("threshold set", {
    sku: data.sku,
    warehouse: data.warehouse,
    min: data.min_quantity,
  });
  return {
    sku: data.sku,
    warehouse: data.warehouse,
    min_quantity: data.min_quantity,
  };
}

export async function getAlerts(): Promise<StockAlert[]> {
  const db = getClient();
  const res = await db.execute(
    `SELECT p.sku AS sku,
            p.name AS product_name,
            w.name AS warehouse,
            COALESCE(i.quantity, 0) AS current,
            t.min_quantity AS minimum
     FROM stock_thresholds t
     JOIN products p ON p.id = t.product_id AND p.deleted_at IS NULL
     JOIN warehouses w ON w.id = t.warehouse_id
     LEFT JOIN inventory i
       ON i.product_id = t.product_id AND i.warehouse_id = t.warehouse_id
     WHERE COALESCE(i.quantity, 0) < t.min_quantity
     ORDER BY p.sku, w.name`,
  );
  return res.rows.map((r) => ({
    sku: String(r.sku),
    product_name: String(r.product_name),
    warehouse: String(r.warehouse),
    current: Number(r.current),
    minimum: Number(r.minimum),
  }));
}
