import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  getOrder,
} from "../src/modules/order.js";
import { NotFoundError, ValidationError } from "../src/errors/index.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "A", name: "Alpha", price: 1000 });
  await addProduct({ sku: "B", name: "Beta", price: 500 });
});

afterEach(() => {
  closeTestDb(db);
});

describe("order.createOrder", () => {
  it("creates an order with single item", async () => {
    const order = await createOrder({
      customer_name: "ACME Corp",
      items: [{ sku: "A", quantity: 2 }],
    });
    expect(order.id).toBeGreaterThan(0);
    expect(order.customer_name).toBe("ACME Corp");
    expect(order.status).toBe("pending");
    expect(order.total_amount).toBe(2000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].unit_price).toBe(1000);
    expect(order.items[0].subtotal).toBe(2000);
  });

  it("creates an order with multiple items and sums total", async () => {
    const order = await createOrder({
      customer_name: "X",
      items: [
        { sku: "A", quantity: 1 },
        { sku: "B", quantity: 3 },
      ],
    });
    expect(order.total_amount).toBe(1000 + 500 * 3);
    expect(order.items).toHaveLength(2);
  });

  it("snapshots unit price from product at creation time", async () => {
    const order = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 1 }],
    });
    expect(order.items[0].unit_price).toBe(1000);
  });

  it("rejects empty items with ValidationError", async () => {
    await expect(
      createOrder({ customer_name: "X", items: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty customer_name with ValidationError", async () => {
    await expect(
      createOrder({ customer_name: "", items: [{ sku: "A", quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects non-positive quantity with ValidationError", async () => {
    await expect(
      createOrder({
        customer_name: "X",
        items: [{ sku: "A", quantity: 0 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError when any SKU is missing", async () => {
    await expect(
      createOrder({
        customer_name: "X",
        items: [
          { sku: "A", quantity: 1 },
          { sku: "GHOST", quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rolls back when one item fails (atomic)", async () => {
    await expect(
      createOrder({
        customer_name: "X",
        items: [
          { sku: "A", quantity: 1 },
          { sku: "GHOST", quantity: 1 },
        ],
      }),
    ).rejects.toThrow();
    const orders = await listOrders();
    expect(orders).toHaveLength(0);
  });
});

describe("order.listOrders", () => {
  it("returns empty list initially", async () => {
    expect(await listOrders()).toEqual([]);
  });

  it("lists all orders sorted by id desc", async () => {
    await createOrder({
      customer_name: "First",
      items: [{ sku: "A", quantity: 1 }],
    });
    await createOrder({
      customer_name: "Second",
      items: [{ sku: "B", quantity: 1 }],
    });
    const orders = await listOrders();
    expect(orders).toHaveLength(2);
    expect(orders[0].customer_name).toBe("Second");
    expect(orders[1].customer_name).toBe("First");
  });

  it("filters by status", async () => {
    const o1 = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 1 }],
    });
    await createOrder({
      customer_name: "Y",
      items: [{ sku: "A", quantity: 1 }],
    });
    await updateOrderStatus(o1.id, "confirmed");
    const confirmed = await listOrders({ status: "confirmed" });
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].id).toBe(o1.id);
  });

  it("filters by customer_name", async () => {
    await createOrder({
      customer_name: "ACME",
      items: [{ sku: "A", quantity: 1 }],
    });
    await createOrder({
      customer_name: "Beta Inc",
      items: [{ sku: "A", quantity: 1 }],
    });
    const acme = await listOrders({ customer_name: "ACME" });
    expect(acme).toHaveLength(1);
    expect(acme[0].customer_name).toBe("ACME");
  });
});

describe("order.updateOrderStatus", () => {
  it("transitions pending -> confirmed", async () => {
    const o = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 1 }],
    });
    const updated = await updateOrderStatus(o.id, "confirmed");
    expect(updated.status).toBe("confirmed");
  });

  it("allows cancellation from pending", async () => {
    const o = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 1 }],
    });
    const updated = await updateOrderStatus(o.id, "cancelled");
    expect(updated.status).toBe("cancelled");
  });

  it("rejects invalid transition (shipped -> pending)", async () => {
    const o = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 1 }],
    });
    await updateOrderStatus(o.id, "confirmed");
    await updateOrderStatus(o.id, "shipped");
    await expect(
      updateOrderStatus(o.id, "pending"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects invalid status value", async () => {
    const o = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 1 }],
    });
    await expect(
      updateOrderStatus(o.id, "unknown" as unknown as "pending"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for unknown order id", async () => {
    await expect(updateOrderStatus(9999, "confirmed")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("order.getOrder", () => {
  it("returns order with items", async () => {
    const o = await createOrder({
      customer_name: "X",
      items: [{ sku: "A", quantity: 2 }],
    });
    const fetched = await getOrder(o.id);
    expect(fetched?.id).toBe(o.id);
    expect(fetched?.items).toHaveLength(1);
  });

  it("returns null for unknown id", async () => {
    expect(await getOrder(9999)).toBeNull();
  });
});
