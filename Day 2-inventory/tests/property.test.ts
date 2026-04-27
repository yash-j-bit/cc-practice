import { beforeEach, afterEach, describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import {
  stockIn,
  stockOut,
  getStockStatus,
  addWarehouse,
  stockTransfer,
} from "../src/modules/stock.js";
import { InsufficientStockError } from "../src/errors/index.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "PBT", name: "Property Test Item", price: 100 });
  await addWarehouse("WH-X");
  await addWarehouse("WH-Y");
});

afterEach(() => {
  closeTestDb(db);
});

describe("Property-based: inventory invariants", () => {
  it("入庫 - 出庫 = 現在在庫 (stockIn - stockOut = current)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom("in", "out") as fc.Arbitrary<"in" | "out">,
            qty: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (ops) => {
          // Fresh DB for each property test run
          const freshDb = await createTestDb();
          try {
            await addProduct({ sku: "PROP", name: "Prop Item", price: 1 });

            let expectedQty = 0;
            for (const op of ops) {
              if (op.type === "in") {
                await stockIn({ sku: "PROP", quantity: op.qty, warehouse: "Main" });
                expectedQty += op.qty;
              } else {
                // out: only if we have enough stock
                if (expectedQty >= op.qty) {
                  await stockOut({ sku: "PROP", quantity: op.qty, warehouse: "Main" });
                  expectedQty -= op.qty;
                }
              }
            }

            const status = await getStockStatus({ sku: "PROP" });
            const actual = status.length > 0 ? status[0].quantity : 0;
            expect(actual).toBe(expectedQty);
          } finally {
            closeTestDb(freshDb);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("在庫は負にならない (inventory cannot be negative)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom("in", "out") as fc.Arbitrary<"in" | "out">,
            qty: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        async (ops) => {
          const freshDb = await createTestDb();
          try {
            await addProduct({ sku: "NEG", name: "Neg Test", price: 1 });

            for (const op of ops) {
              if (op.type === "in") {
                await stockIn({ sku: "NEG", quantity: op.qty, warehouse: "Main" });
              } else {
                try {
                  await stockOut({ sku: "NEG", quantity: op.qty, warehouse: "Main" });
                } catch (e) {
                  expect(e).toBeInstanceOf(InsufficientStockError);
                }
              }
            }

            const status = await getStockStatus({ sku: "NEG" });
            const qty = status.length > 0 ? status[0].quantity : 0;
            expect(qty).toBeGreaterThanOrEqual(0);
          } finally {
            closeTestDb(freshDb);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("移動は在庫の合計を変えない (transfers preserve total)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            from: fc.constantFrom("WH-X", "WH-Y"),
            qty: fc.integer({ min: 1, max: 50 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (transfers) => {
          const freshDb = await createTestDb();
          try {
            await addProduct({ sku: "XFER", name: "Transfer Test", price: 1 });
            await addWarehouse("WH-X");
            await addWarehouse("WH-Y");

            // Seed initial stock
            await stockIn({ sku: "XFER", quantity: 500, warehouse: "WH-X" });
            await stockIn({ sku: "XFER", quantity: 500, warehouse: "WH-Y" });
            const totalBefore = 1000;

            for (const t of transfers) {
              const to = t.from === "WH-X" ? "WH-Y" : "WH-X";
              try {
                await stockTransfer({ sku: "XFER", from: t.from, to, quantity: t.qty });
              } catch (e) {
                expect(e).toBeInstanceOf(InsufficientStockError);
              }
            }

            const status = await getStockStatus({ sku: "XFER" });
            const totalAfter = status.reduce((s, r) => s + r.quantity, 0);
            expect(totalAfter).toBe(totalBefore);
          } finally {
            closeTestDb(freshDb);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("0個入庫はバリデーションエラー (edge case: qty=0)", async () => {
    await expect(
      stockIn({ sku: "PBT", quantity: 0, warehouse: "WH-X" }),
    ).rejects.toThrow();
  });

  it("MAX_SAFE_INTEGER 出庫は InsufficientStockError", async () => {
    await stockIn({ sku: "PBT", quantity: 1, warehouse: "WH-X" });
    await expect(
      stockOut({ sku: "PBT", quantity: Number.MAX_SAFE_INTEGER, warehouse: "WH-X" }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});
