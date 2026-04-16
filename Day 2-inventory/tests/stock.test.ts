import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import {
  stockIn,
  stockOut,
  getStockStatus,
} from "../src/modules/stock.js";
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../src/errors/index.js";
import { DEFAULT_WAREHOUSE_NAME } from "../src/db/schema.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "P1", name: "Product 1", price: 100, cost: 50 });
});

afterEach(() => {
  closeTestDb(db);
});

describe("stock.stockIn", () => {
  it("creates an inventory row on first receipt", async () => {
    const inv = await stockIn({
      sku: "P1",
      quantity: 10,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(inv.quantity).toBe(10);
  });

  it("increments quantity on subsequent receipts", async () => {
    await stockIn({ sku: "P1", quantity: 10, warehouse: DEFAULT_WAREHOUSE_NAME });
    const inv = await stockIn({
      sku: "P1",
      quantity: 5,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(inv.quantity).toBe(15);
  });

  it("records a stock_movement of type 'in'", async () => {
    await stockIn({
      sku: "P1",
      quantity: 7,
      warehouse: DEFAULT_WAREHOUSE_NAME,
      note: "initial receipt",
    });
    const res = await db.execute(
      "SELECT type, quantity, note FROM stock_movements",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].type).toBe("in");
    expect(res.rows[0].quantity).toBe(7);
    expect(res.rows[0].note).toBe("initial receipt");
  });

  it("rejects non-positive quantity with ValidationError", async () => {
    await expect(
      stockIn({ sku: "P1", quantity: 0, warehouse: DEFAULT_WAREHOUSE_NAME }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      stockIn({ sku: "P1", quantity: -1, warehouse: DEFAULT_WAREHOUSE_NAME }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for unknown product", async () => {
    await expect(
      stockIn({ sku: "NOPE", quantity: 1, warehouse: DEFAULT_WAREHOUSE_NAME }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for unknown warehouse", async () => {
    await expect(
      stockIn({ sku: "P1", quantity: 1, warehouse: "Ghost" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("stock.stockOut", () => {
  beforeEach(async () => {
    await stockIn({ sku: "P1", quantity: 10, warehouse: DEFAULT_WAREHOUSE_NAME });
  });

  it("decrements quantity", async () => {
    const inv = await stockOut({
      sku: "P1",
      quantity: 3,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(inv.quantity).toBe(7);
  });

  it("allows reducing to exactly zero", async () => {
    const inv = await stockOut({
      sku: "P1",
      quantity: 10,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(inv.quantity).toBe(0);
  });

  it("throws InsufficientStockError when quantity exceeds available", async () => {
    const err = await stockOut({
      sku: "P1",
      quantity: 99,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect((err as InsufficientStockError).available).toBe(10);
    expect((err as InsufficientStockError).requested).toBe(99);
    expect((err as Error).message).toContain("10");
    expect((err as Error).message).toContain("99");
  });

  it("records a stock_movement of type 'out'", async () => {
    await stockOut({
      sku: "P1",
      quantity: 2,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    const res = await db.execute(
      "SELECT type, quantity FROM stock_movements WHERE type = 'out'",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].quantity).toBe(2);
  });

  it("throws InsufficientStockError when no inventory row exists", async () => {
    await addProduct({ sku: "P2", name: "Product 2", price: 1 });
    await expect(
      stockOut({
        sku: "P2",
        quantity: 1,
        warehouse: DEFAULT_WAREHOUSE_NAME,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});

describe("stock.getStockStatus", () => {
  it("returns empty list when no stock movements", async () => {
    const status = await getStockStatus();
    expect(status).toEqual([]);
  });

  it("returns stock across products and warehouses", async () => {
    await addProduct({ sku: "P2", name: "Product 2", price: 50 });
    await stockIn({ sku: "P1", quantity: 10, warehouse: DEFAULT_WAREHOUSE_NAME });
    await stockIn({ sku: "P2", quantity: 5, warehouse: DEFAULT_WAREHOUSE_NAME });
    const status = await getStockStatus();
    expect(status).toHaveLength(2);
    const bySku = Object.fromEntries(status.map((s) => [s.sku, s.quantity]));
    expect(bySku.P1).toBe(10);
    expect(bySku.P2).toBe(5);
  });

  it("filters by sku", async () => {
    await addProduct({ sku: "P2", name: "Product 2", price: 50 });
    await stockIn({ sku: "P1", quantity: 10, warehouse: DEFAULT_WAREHOUSE_NAME });
    await stockIn({ sku: "P2", quantity: 5, warehouse: DEFAULT_WAREHOUSE_NAME });
    const status = await getStockStatus({ sku: "P1" });
    expect(status).toHaveLength(1);
    expect(status[0].sku).toBe("P1");
  });

  it("filters by warehouse", async () => {
    const status = await getStockStatus({
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(Array.isArray(status)).toBe(true);
  });
});
