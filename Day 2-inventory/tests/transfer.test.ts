import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import {
  stockIn,
  stockTransfer,
  addWarehouse,
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
  await addProduct({ sku: "P1", name: "Product 1", price: 100 });
  await addWarehouse("Tokyo");
  await addWarehouse("Osaka");
});

afterEach(() => {
  closeTestDb(db);
});

describe("stock.addWarehouse", () => {
  it("creates a warehouse", async () => {
    const w = await addWarehouse("Nagoya");
    expect(w.id).toBeGreaterThan(0);
    expect(w.name).toBe("Nagoya");
  });

  it("is idempotent for duplicate names", async () => {
    const a = await addWarehouse("Kyoto");
    const b = await addWarehouse("Kyoto");
    expect(a.id).toBe(b.id);
  });
});

describe("stock.stockTransfer", () => {
  it("moves quantity from source to destination atomically", async () => {
    await stockIn({ sku: "P1", quantity: 100, warehouse: "Tokyo" });
    const result = await stockTransfer({
      sku: "P1",
      from: "Tokyo",
      to: "Osaka",
      quantity: 30,
    });
    expect(result.from.quantity).toBe(70);
    expect(result.to.quantity).toBe(30);
  });

  it("creates destination inventory row on first transfer", async () => {
    await stockIn({ sku: "P1", quantity: 100, warehouse: "Tokyo" });
    await stockTransfer({
      sku: "P1",
      from: "Tokyo",
      to: "Osaka",
      quantity: 10,
    });
    const status = await getStockStatus({ sku: "P1" });
    const osaka = status.find((s) => s.warehouse === "Osaka");
    expect(osaka?.quantity).toBe(10);
  });

  it("accumulates quantity at existing destination", async () => {
    await stockIn({ sku: "P1", quantity: 50, warehouse: "Tokyo" });
    await stockIn({ sku: "P1", quantity: 5, warehouse: "Osaka" });
    await stockTransfer({
      sku: "P1",
      from: "Tokyo",
      to: "Osaka",
      quantity: 20,
    });
    const status = await getStockStatus({ sku: "P1", warehouse: "Osaka" });
    expect(status[0].quantity).toBe(25);
  });

  it("records 'out' + 'in' stock_movements with reference_type='transfer'", async () => {
    await stockIn({ sku: "P1", quantity: 50, warehouse: "Tokyo" });
    await stockTransfer({
      sku: "P1",
      from: "Tokyo",
      to: "Osaka",
      quantity: 5,
    });
    const res = await db.execute(
      "SELECT type, quantity, reference_type FROM stock_movements WHERE reference_type = 'transfer' ORDER BY id",
    );
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].type).toBe("out");
    expect(res.rows[1].type).toBe("in");
  });

  it("throws InsufficientStockError when source qty < requested", async () => {
    await stockIn({ sku: "P1", quantity: 5, warehouse: "Tokyo" });
    await expect(
      stockTransfer({
        sku: "P1",
        from: "Tokyo",
        to: "Osaka",
        quantity: 10,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("rolls back source on failure — inventory remains consistent", async () => {
    await stockIn({ sku: "P1", quantity: 5, warehouse: "Tokyo" });
    await expect(
      stockTransfer({
        sku: "P1",
        from: "Tokyo",
        to: "Osaka",
        quantity: 10,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    const status = await getStockStatus({ sku: "P1" });
    const tokyo = status.find((s) => s.warehouse === "Tokyo");
    expect(tokyo?.quantity).toBe(5);
    const osaka = status.find((s) => s.warehouse === "Osaka");
    expect(osaka).toBeUndefined();
    const movements = await db.execute(
      "SELECT COUNT(*) AS n FROM stock_movements WHERE reference_type = 'transfer'",
    );
    expect(Number(movements.rows[0].n)).toBe(0);
  });

  it("rejects from === to", async () => {
    await stockIn({ sku: "P1", quantity: 10, warehouse: "Tokyo" });
    await expect(
      stockTransfer({
        sku: "P1",
        from: "Tokyo",
        to: "Tokyo",
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects non-positive quantity", async () => {
    await expect(
      stockTransfer({
        sku: "P1",
        from: "Tokyo",
        to: "Osaka",
        quantity: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for unknown product", async () => {
    await expect(
      stockTransfer({
        sku: "NOPE",
        from: "Tokyo",
        to: "Osaka",
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for unknown source warehouse", async () => {
    await expect(
      stockTransfer({
        sku: "P1",
        from: "Ghost",
        to: "Osaka",
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("preserves conservation of inventory (sum before == sum after)", async () => {
    await stockIn({ sku: "P1", quantity: 100, warehouse: "Tokyo" });
    await stockTransfer({
      sku: "P1",
      from: "Tokyo",
      to: "Osaka",
      quantity: 40,
    });
    const status = await getStockStatus({ sku: "P1" });
    const total = status.reduce((sum, s) => sum + s.quantity, 0);
    expect(total).toBe(100);
    void DEFAULT_WAREHOUSE_NAME;
  });
});
