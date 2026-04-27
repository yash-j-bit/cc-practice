import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import {
  lotIn,
  lotOutFifo,
  getLots,
  getExpiryAlerts,
} from "../src/modules/lots.js";
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../src/errors/index.js";
import { DEFAULT_WAREHOUSE_NAME } from "../src/db/schema.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "LOT-1", name: "Lot Test Item", price: 100 });
});

afterEach(() => {
  closeTestDb(db);
});

describe("lots.lotIn", () => {
  it("receives a lot with quantity and lot number", async () => {
    const lot = await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "BATCH-001",
      quantity: 100,
    });
    expect(lot.id).toBeGreaterThan(0);
    expect(lot.lot_number).toBe("BATCH-001");
    expect(lot.quantity).toBe(100);
  });

  it("receives a lot with expiry date", async () => {
    const lot = await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "BATCH-002",
      quantity: 50,
      expiry_date: "2027-06-30",
    });
    expect(lot.expiry_date).toBe("2027-06-30");
  });

  it("rejects unknown product", async () => {
    await expect(
      lotIn({ sku: "NOPE", warehouse: DEFAULT_WAREHOUSE_NAME, lot_number: "X", quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects non-positive quantity (zero)", async () => {
    await expect(
      lotIn({ sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME, lot_number: "X", quantity: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects negative quantity", async () => {
    await expect(
      lotIn({ sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME, lot_number: "X", quantity: -5 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects unknown warehouse", async () => {
    await expect(
      lotIn({ sku: "LOT-1", warehouse: "Ghost", lot_number: "X", quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects empty lot_number", async () => {
    await expect(
      lotIn({ sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME, lot_number: "", quantity: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("lots.lotOutFifo", () => {
  beforeEach(async () => {
    // Insert 3 lots in order: BATCH-A (oldest), BATCH-B, BATCH-C (newest)
    await lotIn({
      sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "BATCH-A", quantity: 30,
    });
    await lotIn({
      sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "BATCH-B", quantity: 20,
    });
    await lotIn({
      sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "BATCH-C", quantity: 50,
    });
  });

  it("consumes from the oldest lot first (FIFO)", async () => {
    const result = await lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 25);
    expect(result.total_consumed).toBe(25);
    expect(result.consumed).toHaveLength(1);
    expect(result.consumed[0].lot_number).toBe("BATCH-A");
    expect(result.consumed[0].quantity).toBe(25);

    const lots = await getLots("LOT-1", DEFAULT_WAREHOUSE_NAME);
    expect(lots.find((l) => l.lot_number === "BATCH-A")?.quantity).toBe(5);
  });

  it("spans multiple lots when needed", async () => {
    const result = await lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 40);
    expect(result.consumed).toHaveLength(2);
    expect(result.consumed[0].lot_number).toBe("BATCH-A");
    expect(result.consumed[0].quantity).toBe(30); // fully consumed
    expect(result.consumed[1].lot_number).toBe("BATCH-B");
    expect(result.consumed[1].quantity).toBe(10);
  });

  it("consumes all lots when requesting total", async () => {
    const result = await lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 100);
    expect(result.consumed).toHaveLength(3);
    expect(result.total_consumed).toBe(100);
    const lots = await getLots("LOT-1", DEFAULT_WAREHOUSE_NAME);
    expect(lots).toHaveLength(0); // all consumed
  });

  it("throws InsufficientStockError when requesting more than available", async () => {
    await expect(
      lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 200),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("rolls back all lot updates on failure (transaction safety)", async () => {
    // We can't easily force a mid-transaction failure with real data,
    // so verify that InsufficientStockError doesn't modify lots
    await expect(
      lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 200),
    ).rejects.toThrow();

    const lots = await getLots("LOT-1", DEFAULT_WAREHOUSE_NAME);
    const total = lots.reduce((sum, l) => sum + l.quantity, 0);
    expect(total).toBe(100); // unchanged
  });

  it("rejects zero quantity", async () => {
    await expect(
      lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 0),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects negative quantity", async () => {
    await expect(
      lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, -1),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for unknown product", async () => {
    await expect(
      lotOutFifo("NOPE", DEFAULT_WAREHOUSE_NAME, 1),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for unknown warehouse", async () => {
    await expect(
      lotOutFifo("LOT-1", "Ghost", 1),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("lots.getLots", () => {
  it("returns lots in FIFO order (oldest first)", async () => {
    await lotIn({
      sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "FIRST", quantity: 10,
    });
    await lotIn({
      sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "SECOND", quantity: 20,
    });
    const lots = await getLots("LOT-1", DEFAULT_WAREHOUSE_NAME);
    expect(lots).toHaveLength(2);
    expect(lots[0].lot_number).toBe("FIRST");
    expect(lots[1].lot_number).toBe("SECOND");
  });

  it("returns empty when no lots exist", async () => {
    const lots = await getLots("LOT-1", DEFAULT_WAREHOUSE_NAME);
    expect(lots).toHaveLength(0);
  });

  it("throws NotFoundError for unknown product", async () => {
    await expect(
      getLots("NOPE", DEFAULT_WAREHOUSE_NAME),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for unknown warehouse", async () => {
    await expect(
      getLots("LOT-1", "Ghost"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("excludes fully consumed lots (quantity = 0)", async () => {
    await lotIn({
      sku: "LOT-1", warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "EMPTY", quantity: 5,
    });
    await lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 5);
    const lots = await getLots("LOT-1", DEFAULT_WAREHOUSE_NAME);
    expect(lots).toHaveLength(0);
  });
});

describe("lots.getExpiryAlerts", () => {
  it("returns lots expiring within specified days", async () => {
    // Lot expiring tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "EXPIRING-SOON",
      quantity: 10,
      expiry_date: tomorrowStr,
    });

    const alerts = await getExpiryAlerts(30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].lot_number).toBe("EXPIRING-SOON");
    expect(alerts[0].days_remaining).toBeLessThanOrEqual(30);
  });

  it("does not return lots with no expiry date", async () => {
    await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "NO-EXPIRY",
      quantity: 10,
    });
    const alerts = await getExpiryAlerts(30);
    expect(alerts).toHaveLength(0);
  });

  it("does not return already-expired lots", async () => {
    await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "EXPIRED",
      quantity: 10,
      expiry_date: "2020-01-01",
    });
    const alerts = await getExpiryAlerts(30);
    expect(alerts).toHaveLength(0);
  });

  it("does not return fully consumed lots even if expiring", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "CONSUMED-SOON",
      quantity: 5,
      expiry_date: tomorrowStr,
    });
    await lotOutFifo("LOT-1", DEFAULT_WAREHOUSE_NAME, 5);
    const alerts = await getExpiryAlerts(30);
    expect(alerts).toHaveLength(0);
  });

  it("returns empty when no lots exist at all", async () => {
    const alerts = await getExpiryAlerts(30);
    expect(alerts).toHaveLength(0);
  });

  it("does not return lots expiring beyond the threshold", async () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 1);
    const farStr = farFuture.toISOString().split("T")[0];

    await lotIn({
      sku: "LOT-1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      lot_number: "FAR-FUTURE",
      quantity: 10,
      expiry_date: farStr,
    });
    const alerts = await getExpiryAlerts(30);
    expect(alerts).toHaveLength(0);
  });
});
