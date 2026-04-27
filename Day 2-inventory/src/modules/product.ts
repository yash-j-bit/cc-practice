import { z } from "zod";
import { getClient } from "../db/client.js";
import {
  NotFoundError,
  ConflictError,
} from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { parse } from "../utils/validation.js";

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const addSchema = z.object({
  sku: z.string().min(1, "sku is required"),
  name: z.string().min(1, "name is required"),
  price: z.number().nonnegative("price must be >= 0"),
  cost: z.number().nonnegative("cost must be >= 0").optional(),
  description: z.string().optional(),
});

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    price: z.number().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
    description: z.string().optional(),
  })
  .refine(
    (v) => Object.values(v).some((x) => x !== undefined),
    { message: "at least one field is required" },
  );

export type AddProductInput = z.infer<typeof addSchema>;
export type UpdateProductInput = z.infer<typeof updateSchema>;

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: Number(row.id),
    sku: String(row.sku),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    price: Number(row.price),
    cost: Number(row.cost),
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function addProduct(input: AddProductInput): Promise<Product> {
  const data = parse(addSchema, input);
  const db = getClient();

  try {
    const result = await db.execute({
      sql: `INSERT INTO products (sku, name, description, price, cost)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        data.sku,
        data.name,
        data.description ?? null,
        data.price,
        data.cost ?? 0,
      ],
    });
    const id = Number(result.lastInsertRowid);
    logger.info("product added", { id, sku: data.sku });
    const p = await getProductById(id);
    if (!p) throw new Error("product insertion race");
    return p;
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new ConflictError(`Product with sku ${data.sku} already exists`);
    }
    throw err;
  }
}

export interface ListOptions {
  includeDeleted?: boolean;
}

export async function listProducts(opts: ListOptions = {}): Promise<Product[]> {
  const db = getClient();
  const sql = opts.includeDeleted
    ? "SELECT * FROM products ORDER BY id"
    : "SELECT * FROM products WHERE deleted_at IS NULL ORDER BY id";
  const res = await db.execute(sql);
  return res.rows.map((r) => rowToProduct(r as Record<string, unknown>));
}

export async function getProductBySku(
  sku: string,
  opts: ListOptions = {},
): Promise<Product | null> {
  const db = getClient();
  const sql = opts.includeDeleted
    ? "SELECT * FROM products WHERE sku = ?"
    : "SELECT * FROM products WHERE sku = ? AND deleted_at IS NULL";
  const res = await db.execute({ sql, args: [sku] });
  if (res.rows.length === 0) return null;
  return rowToProduct(res.rows[0] as Record<string, unknown>);
}

async function getProductById(id: number): Promise<Product | null> {
  const db = getClient();
  const res = await db.execute({
    sql: "SELECT * FROM products WHERE id = ?",
    args: [id],
  });
  if (res.rows.length === 0) return null;
  return rowToProduct(res.rows[0] as Record<string, unknown>);
}

export async function updateProduct(
  sku: string,
  input: UpdateProductInput,
): Promise<Product> {
  const data = parse(updateSchema, input);
  const existing = await getProductBySku(sku);
  if (!existing) throw new NotFoundError("product", sku);

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (data.name !== undefined) {
    sets.push("name = ?");
    args.push(data.name);
  }
  if (data.price !== undefined) {
    sets.push("price = ?");
    args.push(data.price);
  }
  if (data.cost !== undefined) {
    sets.push("cost = ?");
    args.push(data.cost);
  }
  if (data.description !== undefined) {
    sets.push("description = ?");
    args.push(data.description);
  }
  sets.push("updated_at = datetime('now')");
  args.push(sku);

  const db = getClient();
  await db.execute({
    sql: `UPDATE products SET ${sets.join(", ")} WHERE sku = ?`,
    args,
  });
  logger.info("product updated", { sku });
  const updated = await getProductBySku(sku);
  if (!updated) throw new Error("product disappeared after update");
  return updated;
}

export async function deleteProduct(sku: string): Promise<void> {
  const existing = await getProductBySku(sku);
  if (!existing) throw new NotFoundError("product", sku);
  const db = getClient();
  await db.execute({
    sql: "UPDATE products SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE sku = ?",
    args: [sku],
  });
  logger.info("product soft-deleted", { sku });
}
