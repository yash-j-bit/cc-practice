import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import { stockIn } from "../src/modules/stock.js";
import { setThreshold, getAlerts } from "../src/modules/alerts.js";
import { NotFoundError, ValidationError } from "../src/errors/index.js";
import { DEFAULT_WAREHOUSE_NAME } from "../src/db/schema.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "P1", name: "Product 1", price: 100 });
});

afterEach(() => {
  closeTestDb(db);
});

describe("alerts.setThreshold", () => {
  it("sets a threshold for a product+warehouse", async () => {
    const t = await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 10,
    });
    expect(t.min_quantity).toBe(10);
  });

  it("upserts when called twice", async () => {
    await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 10,
    });
    const t = await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 20,
    });
    expect(t.min_quantity).toBe(20);
  });

  it("rejects negative min_quantity", async () => {
    await expect(
      setThreshold({
        sku: "P1",
        warehouse: DEFAULT_WAREHOUSE_NAME,
        min_quantity: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for unknown product", async () => {
    await expect(
      setThreshold({
        sku: "NOPE",
        warehouse: DEFAULT_WAREHOUSE_NAME,
        min_quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for unknown warehouse", async () => {
    await expect(
      setThreshold({ sku: "P1", warehouse: "Ghost", min_quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("alerts.getAlerts", () => {
  it("returns empty when no thresholds set", async () => {
    expect(await getAlerts()).toEqual([]);
  });

  it("returns alert when current < minimum", async () => {
    await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 10,
    });
    await stockIn({
      sku: "P1",
      quantity: 5,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    const alerts = await getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].sku).toBe("P1");
    expect(alerts[0].current).toBe(5);
    expect(alerts[0].minimum).toBe(10);
  });

  it("does NOT alert when current === minimum (boundary)", async () => {
    await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 10,
    });
    await stockIn({
      sku: "P1",
      quantity: 10,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(await getAlerts()).toEqual([]);
  });

  it("does NOT alert when current > minimum", async () => {
    await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 10,
    });
    await stockIn({
      sku: "P1",
      quantity: 20,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    expect(await getAlerts()).toEqual([]);
  });

  it("alerts when threshold set but no inventory row exists (current = 0)", async () => {
    await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 1,
    });
    const alerts = await getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].current).toBe(0);
  });

  it("returns multiple alerts for different products", async () => {
    await addProduct({ sku: "P2", name: "Product 2", price: 50 });
    await setThreshold({
      sku: "P1",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 10,
    });
    await setThreshold({
      sku: "P2",
      warehouse: DEFAULT_WAREHOUSE_NAME,
      min_quantity: 5,
    });
    await stockIn({
      sku: "P1",
      quantity: 1,
      warehouse: DEFAULT_WAREHOUSE_NAME,
    });
    const alerts = await getAlerts();
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.sku).sort()).toEqual(["P1", "P2"]);
  });
});
