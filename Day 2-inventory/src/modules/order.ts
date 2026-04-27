import { z } from "zod";
import { getClient, withTransaction } from "../db/client.js";
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { parse } from "../utils/validation.js";

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
  warehouse: z.string().min(1).optional(),
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

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const data = parse(createOrderSchema, input);
  const db = getClient();

  let warehouseId: number | null = null;
  if (data.warehouse) {
    const wRes = await db.execute({
      sql: "SELECT id FROM warehouses WHERE name = ?",
      args: [data.warehouse],
    });
    if (wRes.rows.length === 0) {
      throw new NotFoundError("warehouse", data.warehouse);
    }
    warehouseId = Number(wRes.rows[0].id);
  }

  type Resolved = {
    sku: string;
    product_id: number;
    unit_price: number;
    quantity: number;
  };

  const orderId = await withTransaction(async (db) => {
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

    if (warehouseId !== null) {
      for (const r of resolved) {
        const invRes = await db.execute({
          sql: "SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ?",
          args: [r.product_id, warehouseId],
        });
        const available = invRes.rows.length === 0 ? 0 : Number(invRes.rows[0].quantity);
        if (available < r.quantity) {
          throw new InsufficientStockError(available, r.quantity);
        }
      }
    }

    const total = resolved.reduce(
      (sum, r) => sum + r.unit_price * r.quantity,
      0,
    );

    const orderResult = await db.execute({
      sql: "INSERT INTO orders (customer_name, status, total_amount) VALUES (?, 'pending', ?)",
      args: [data.customer_name, total],
    });
    const id = Number(orderResult.lastInsertRowid);

    for (const r of resolved) {
      await db.execute({
        sql: `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
              VALUES (?, ?, ?, ?, ?)`,
        args: [id, r.product_id, r.quantity, r.unit_price, r.unit_price * r.quantity],
      });

      if (warehouseId !== null) {
        await db.execute({
          sql: "UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ? AND warehouse_id = ?",
          args: [r.quantity, r.product_id, warehouseId],
        });
        await db.execute({
          sql: `INSERT INTO stock_movements
                (product_id, warehouse_id, type, quantity, reference_type, reference_id)
                VALUES (?, ?, 'out', ?, 'order', ?)`,
          args: [r.product_id, warehouseId, r.quantity, id],
        });
      }
    }

    return id;
  });

  logger.info("order created", { id: orderId, total_amount: "computed", reserved: warehouseId !== null });
  const order = await getOrder(orderId);
  if (!order) throw new Error("order disappeared after creation");
  return order;
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
    conditions.push("o.status = ?");
    args.push(opts.status);
  }
  if (opts.customer_name) {
    conditions.push("o.customer_name = ?");
    args.push(opts.customer_name);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const ordersRes = await db.execute({
    sql: `SELECT * FROM orders o ${where} ORDER BY o.id DESC`,
    args,
  });
  if (ordersRes.rows.length === 0) return [];

  const orderIds = ordersRes.rows.map((r) => Number(r.id));
  const placeholders = orderIds.map(() => "?").join(",");
  const itemsRes = await db.execute({
    sql: `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
                 p.sku AS sku
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id IN (${placeholders})
          ORDER BY oi.id`,
    args: orderIds,
  });

  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const r of itemsRes.rows) {
    const orderId = Number(r.order_id);
    const item: OrderItem = {
      id: Number(r.id),
      order_id: orderId,
      product_id: Number(r.product_id),
      sku: String(r.sku),
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      subtotal: Number(r.subtotal),
    };
    const list = itemsByOrder.get(orderId) ?? [];
    list.push(item);
    itemsByOrder.set(orderId, list);
  }

  return ordersRes.rows.map((o) => ({
    id: Number(o.id),
    customer_name: String(o.customer_name),
    status: String(o.status) as OrderStatus,
    total_amount: Number(o.total_amount),
    created_at: String(o.created_at),
    updated_at: String(o.updated_at),
    items: itemsByOrder.get(Number(o.id)) ?? [],
  }));
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

  // Restore reserved stock when cancelling
  if (newStatus === "cancelled") {
    const movements = await db.execute({
      sql: `SELECT product_id, warehouse_id, quantity FROM stock_movements
            WHERE reference_type = 'order' AND reference_id = ?`,
      args: [id],
    });
    if (movements.rows.length > 0) {
      await withTransaction(async (txDb) => {
        await txDb.execute({
          sql: "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
          args: [newStatus, id],
        });
        for (const m of movements.rows) {
          await txDb.execute({
            sql: "UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND warehouse_id = ?",
            args: [Number(m.quantity), Number(m.product_id), Number(m.warehouse_id)],
          });
          await txDb.execute({
            sql: `INSERT INTO stock_movements
                  (product_id, warehouse_id, type, quantity, reference_type, reference_id, note)
                  VALUES (?, ?, 'in', ?, 'order_cancel', ?, 'stock restored on cancellation')`,
            args: [Number(m.product_id), Number(m.warehouse_id), Number(m.quantity), id],
          });
        }
      });
      logger.info("order cancelled, stock restored", { id });
      const updated = await getOrder(id);
      if (!updated) throw new Error("order disappeared after status update");
      return updated;
    }
  }

  await db.execute({
    sql: "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [newStatus, id],
  });
  logger.info("order status updated", { id, from: current.status, to: newStatus });
  const updated = await getOrder(id);
  if (!updated) throw new Error("order disappeared after status update");
  return updated;
}
