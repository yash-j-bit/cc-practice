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
import { createOrder, listOrders } from "../src/modules/order.js";
import { InsufficientStockError } from "../src/errors/index.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "TX-1", name: "Transaction Test Item", price: 1000 });
  await addWarehouse("WH-A");
  await addWarehouse("WH-B");
  await stockIn({ sku: "TX-1", quantity: 100, warehouse: "WH-A" });
});

afterEach(() => {
  closeTestDb(db);
});

describe("Transaction safety: transfer rollback", () => {
  it("rolls back completely when transfer fails mid-operation", async () => {
    // initial state: WH-A=100, WH-B=0
    await expect(
      stockTransfer({ sku: "TX-1", from: "WH-A", to: "WH-B", quantity: 200 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // verify: inventory unchanged
    const status = await getStockStatus({ sku: "TX-1" });
    const whA = status.find((s) => s.warehouse === "WH-A");
    const whB = status.find((s) => s.warehouse === "WH-B");
    expect(whA?.quantity).toBe(100);
    expect(whB).toBeUndefined(); // no row created

    // verify: no movement records leaked
    const movements = await db.execute(
      "SELECT COUNT(*) AS n FROM stock_movements WHERE reference_type = 'transfer'",
    );
    expect(Number(movements.rows[0].n)).toBe(0);
  });

  it("preserves conservation of inventory after successful transfer", async () => {
    const beforeTotal = await getTotalInventory("TX-1");
    await stockTransfer({ sku: "TX-1", from: "WH-A", to: "WH-B", quantity: 40 });
    const afterTotal = await getTotalInventory("TX-1");
    expect(afterTotal).toBe(beforeTotal);
  });

  it("preserves conservation after multiple sequential transfers", async () => {
    await stockIn({ sku: "TX-1", quantity: 50, warehouse: "WH-B" });
    const beforeTotal = await getTotalInventory("TX-1");

    await stockTransfer({ sku: "TX-1", from: "WH-A", to: "WH-B", quantity: 30 });
    await stockTransfer({ sku: "TX-1", from: "WH-B", to: "WH-A", quantity: 10 });
    await stockTransfer({ sku: "TX-1", from: "WH-A", to: "WH-B", quantity: 5 });

    const afterTotal = await getTotalInventory("TX-1");
    expect(afterTotal).toBe(beforeTotal);
  });
});

describe("Transaction safety: order rollback", () => {
  it("rolls back stock reservation when one item is insufficient", async () => {
    await addProduct({ sku: "TX-2", name: "Scarce Item", price: 500 });
    await stockIn({ sku: "TX-2", quantity: 2, warehouse: "WH-A" });

    // TX-1 has 100, TX-2 has 2 — order 10 of TX-2 should fail
    await expect(
      createOrder({
        customer_name: "Test",
        warehouse: "WH-A",
        items: [
          { sku: "TX-1", quantity: 5 },
          { sku: "TX-2", quantity: 10 },
        ],
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // verify: ALL inventory unchanged (TX-1 should not have been decremented)
    const status = await getStockStatus({ sku: "TX-1", warehouse: "WH-A" });
    expect(status[0].quantity).toBe(100);

    const status2 = await getStockStatus({ sku: "TX-2", warehouse: "WH-A" });
    expect(status2[0].quantity).toBe(2);

    // verify: no order created
    const orders = await listOrders();
    expect(orders).toHaveLength(0);
  });
});

describe("Transaction safety: concurrent-like sequential transfers", () => {
  it("two sequential transfers maintain total inventory count", async () => {
    await stockIn({ sku: "TX-1", quantity: 50, warehouse: "WH-B" });
    const totalBefore = await getTotalInventory("TX-1");

    // Simulate two "concurrent" transfers (sequential in libSQL, but proves invariant)
    await stockTransfer({ sku: "TX-1", from: "WH-A", to: "WH-B", quantity: 20 });
    await stockTransfer({ sku: "TX-1", from: "WH-B", to: "WH-A", quantity: 15 });

    const totalAfter = await getTotalInventory("TX-1");
    expect(totalAfter).toBe(totalBefore);

    const status = await getStockStatus({ sku: "TX-1" });
    const whA = status.find((s) => s.warehouse === "WH-A")!;
    const whB = status.find((s) => s.warehouse === "WH-B")!;
    expect(whA.quantity).toBe(100 - 20 + 15); // 95
    expect(whB.quantity).toBe(50 + 20 - 15);  // 55
  });
});

async function getTotalInventory(sku: string): Promise<number> {
  const status = await getStockStatus({ sku });
  return status.reduce((sum, s) => sum + s.quantity, 0);
}
