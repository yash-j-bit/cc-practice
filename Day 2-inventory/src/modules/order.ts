import { z } from "zod";
import { getClient } from "../db/client.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  customer_name: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

const createOrderSchema = z.object({
  customer_name: z.string().min(1, "customer_name is required"),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive("item quantity must be > 0"),
      }),
    )
    .min(1, "at least one item is required"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

function parse<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => i.message).join("; "),
    );
  }
  return result.data;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const data = parse(createOrderSchema, input);
  const db = getClient();

  await db.execute("BEGIN");
  try {
    type Resolved = {
      sku: string;
      product_id: number;
      unit_price: number;
      quantity: number;
    };
    const resolved: Resolved[] = [];
    for (const item of data.items) {
      const res = await db.execute({
        sql: "SELECT id, price FROM products WHERE sku = ? AND deleted_at IS NULL",
        args: [item.sku],
      });
      if (res.rows.length === 0) {
        throw new NotFoundError("product", item.sku);
      }
      resolved.push({
        sku: item.sku,
        product_id: Number(res.rows[0].id),
        unit_price: Number(res.rows[0].price),
        quantity: item.quantity,
      });
    }

    const total = resolved.reduce(
      (sum, r) => sum + r.unit_price * r.quantity,
      0,
    );

    const orderResult = await db.execute({
      sql: "INSERT INTO orders (customer_name, status, total_amount) VALUES (?, 'pending', ?)",
      args: [data.customer_name, total],
    });
    const orderId = Number(orderResult.lastInsertRowid);

    for (const r of resolved) {
      await db.execute({
        sql: `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
              VALUES (?, ?, ?, ?, ?)`,
        args: [orderId, r.product_id, r.quantity, r.unit_price, r.unit_price * r.quantity],
      });
    }

    await db.execute("COMMIT");
    logger.info("order created", { id: orderId, total });
    const order = await getOrder(orderId);
    if (!order) throw new Error("order disappeared after creation");
    return order;
  } catch (err) {
    await db.execute("ROLLBACK");
    throw err;
  }
}

export interface ListOrdersOptions {
  status?: OrderStatus;
  customer_name?: string;
}

export async function listOrders(
  opts: ListOrdersOptions = {},
): Promise<Order[]> {
  const db = getClient();
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (opts.status) {
    conditions.push("status = ?");
    args.push(opts.status);
  }
  if (opts.customer_name) {
    conditions.push("customer_name = ?");
    args.push(opts.customer_name);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const res = await db.execute({
    sql: `SELECT id FROM orders ${where} ORDER BY id DESC`,
    args,
  });
  const orders: Order[] = [];
  for (const row of res.rows) {
    const order = await getOrder(Number(row.id));
    if (order) orders.push(order);
  }
  return orders;
}

export async function getOrder(id: number): Promise<Order | null> {
  const db = getClient();
  const orderRes = await db.execute({
    sql: "SELECT * FROM orders WHERE id = ?",
    args: [id],
  });
  if (orderRes.rows.length === 0) return null;
  const o = orderRes.rows[0];

  const itemsRes = await db.execute({
    sql: `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
                 p.sku AS sku
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ?
          ORDER BY oi.id`,
    args: [id],
  });
  const items: OrderItem[] = itemsRes.rows.map((r) => ({
    id: Number(r.id),
    order_id: Number(r.order_id),
    product_id: Number(r.product_id),
    sku: String(r.sku),
    quantity: Number(r.quantity),
    unit_price: Number(r.unit_price),
    subtotal: Number(r.subtotal),
  }));

  return {
    id: Number(o.id),
    customer_name: String(o.customer_name),
    status: String(o.status) as OrderStatus,
    total_amount: Number(o.total_amount),
    created_at: String(o.created_at),
    updated_at: String(o.updated_at),
    items,
  };
}

export async function updateOrderStatus(
  id: number,
  newStatus: OrderStatus,
): Promise<Order> {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new ValidationError(`invalid status: ${newStatus}`);
  }
  const current = await getOrder(id);
  if (!current) throw new NotFoundError("order", id);

  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `invalid transition: ${current.status} -> ${newStatus}`,
    );
  }

  const db = getClient();
  await db.execute({
    sql: "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [newStatus, id],
  });
  logger.info("order status updated", { id, from: current.status, to: newStatus });
  const updated = await getOrder(id);
  if (!updated) throw new Error("order disappeared after status update");
  return updated;
}
