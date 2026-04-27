import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { addProduct } from "../src/modules/product.js";
import { stockIn, stockOut } from "../src/modules/stock.js";
import { DEFAULT_WAREHOUSE_NAME } from "../src/db/schema.js";
import {
  getShipmentHistory,
  movingAverage,
  stdDeviation,
  safetyStock,
  reorderPoint,
  forecast,
  forecastToCsv,
  forecastToMermaid,
} from "../src/modules/forecast.js";
import { NotFoundError } from "../src/errors/index.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await addProduct({ sku: "FC-1", name: "Forecast Item", price: 100 });
  await stockIn({ sku: "FC-1", quantity: 1000, warehouse: DEFAULT_WAREHOUSE_NAME });
});

afterEach(() => {
  closeTestDb(db);
});

describe("forecast.getShipmentHistory", () => {
  it("returns empty array when no outbound movements exist", async () => {
    const history = await getShipmentHistory("FC-1", DEFAULT_WAREHOUSE_NAME, 30);
    expect(history).toEqual([]);
  });

  it("returns daily aggregated outbound quantities", async () => {
    await stockOut({ sku: "FC-1", quantity: 10, warehouse: DEFAULT_WAREHOUSE_NAME });
    await stockOut({ sku: "FC-1", quantity: 5, warehouse: DEFAULT_WAREHOUSE_NAME });
    const history = await getShipmentHistory("FC-1", DEFAULT_WAREHOUSE_NAME, 30);
    expect(history).toHaveLength(1); // same day
    expect(history[0].quantity).toBe(15); // aggregated
    expect(history[0].date).toBeDefined();
  });

  it("throws NotFoundError for unknown product", async () => {
    await expect(
      getShipmentHistory("NOPE", DEFAULT_WAREHOUSE_NAME, 30),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for unknown warehouse", async () => {
    await expect(
      getShipmentHistory("FC-1", "Ghost", 30),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not include inbound movements", async () => {
    // FC-1 already has 1000 from stockIn in beforeEach — that should NOT appear
    const history = await getShipmentHistory("FC-1", DEFAULT_WAREHOUSE_NAME, 30);
    expect(history).toEqual([]);
  });
});

describe("forecast: pure functions", () => {
  it("movingAverage computes correctly", () => {
    expect(movingAverage([10, 20, 30])).toBe(20);
    expect(movingAverage([])).toBe(0);
    expect(movingAverage([5])).toBe(5);
  });

  it("stdDeviation computes correctly", () => {
    expect(stdDeviation([10, 10, 10])).toBe(0);
    expect(stdDeviation([])).toBe(0);
    expect(stdDeviation([5])).toBe(0);
    // sample std dev of [2, 4, 4, 4, 5, 5, 7, 9] ≈ 2.14 (Bessel's correction, n-1)
    expect(Math.round(stdDeviation([2, 4, 4, 4, 5, 5, 7, 9]) * 100) / 100).toBe(2.14);
  });

  it("safetyStock = Z * σ * √(leadTime), rounded up", () => {
    // Z=1.96, σ=10, LT=4 → 1.96 * 10 * 2 = 39.2 → ceil = 40
    expect(safetyStock(10, 4, 1.96)).toBe(40);
    expect(safetyStock(0, 7)).toBe(0);
  });

  it("reorderPoint = avg*LT + safety", () => {
    // avg=5, LT=7, safety=10 → 5*7 + 10 = 45
    expect(reorderPoint(5, 7, 10)).toBe(45);
  });
});

describe("forecast: integration", () => {
  it("returns forecast with no shipments", async () => {
    const result = await forecast("FC-1", DEFAULT_WAREHOUSE_NAME, 30, 7);
    expect(result.sku).toBe("FC-1");
    expect(result.daily_shipments).toEqual([]);
    expect(result.moving_average).toBe(0);
    expect(result.recommendation).toContain("出庫履歴なし");
  });

  it("computes forecast after shipments", async () => {
    // Create some outbound movements
    await stockOut({ sku: "FC-1", quantity: 10, warehouse: DEFAULT_WAREHOUSE_NAME });
    await stockOut({ sku: "FC-1", quantity: 20, warehouse: DEFAULT_WAREHOUSE_NAME });
    await stockOut({ sku: "FC-1", quantity: 15, warehouse: DEFAULT_WAREHOUSE_NAME });

    const result = await forecast("FC-1", DEFAULT_WAREHOUSE_NAME, 30, 7);
    // All 3 stockOuts happen on the same day, so we should get 1 daily entry
    expect(result.daily_shipments.length).toBeGreaterThanOrEqual(1);
    expect(result.moving_average).toBeGreaterThan(0);
    expect(result.recommendation).toContain("推奨発注点");
  });
});

describe("forecast: output formats", () => {
  it("forecastToCsv generates valid CSV", () => {
    const csv = forecastToCsv({
      sku: "X",
      warehouse: "W",
      period_days: 7,
      daily_shipments: [
        { date: "2026-01-01", quantity: 10 },
        { date: "2026-01-02", quantity: 20 },
      ],
      moving_average: 15,
      std_deviation: 5,
      lead_time_days: 3,
      safety_stock: 17,
      reorder_point: 62,
      confidence_interval: { lower: 8.07, upper: 21.93 },
      recommendation: "test",
    });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("date,quantity,moving_avg,upper_ci,lower_ci");
    expect(lines[1]).toBe("2026-01-01,10,15,21.93,8.07");
    expect(lines).toHaveLength(3);
  });

  it("forecastToMermaid generates chart definition", () => {
    const chart = forecastToMermaid({
      sku: "X",
      warehouse: "W",
      period_days: 7,
      daily_shipments: [
        { date: "2026-01-01", quantity: 10 },
        { date: "2026-01-02", quantity: 20 },
      ],
      moving_average: 15,
      std_deviation: 5,
      lead_time_days: 3,
      safety_stock: 17,
      reorder_point: 62,
      confidence_interval: { lower: 8, upper: 22 },
      recommendation: "test",
    });
    expect(chart).toContain("xychart-beta");
    expect(chart).toContain("Demand Forecast");
    expect(chart).toContain("bar");
    expect(chart).toContain("line");
  });

  it("forecastToMermaid handles empty data", () => {
    const chart = forecastToMermaid({
      sku: "X",
      warehouse: "W",
      period_days: 7,
      daily_shipments: [],
      moving_average: 0,
      std_deviation: 0,
      lead_time_days: 3,
      safety_stock: 0,
      reorder_point: 0,
      confidence_interval: { lower: 0, upper: 0 },
      recommendation: "no data",
    });
    expect(chart).toContain("No data available");
  });
});

