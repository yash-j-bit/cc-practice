import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { app } from "../src/server/index.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  closeTestDb(db);
});

function req(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: {
      "X-API-Key": "dev-key-12345",
      ...headers,
    },
  };
  if (body) {
    init.headers = { ...init.headers as Record<string, string>, "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

describe("API: authentication", () => {
  it("rejects requests without API key", async () => {
    const res = await app.request("/api/products");
    expect(res.status).toBe(401);
  });

  it("accepts requests with valid API key", async () => {
    const res = await req("GET", "/api/products");
    expect(res.status).toBe(200);
  });
});

describe("API: products", () => {
  it("POST /api/products creates a product", async () => {
    const res = await req("POST", "/api/products", {
      sku: "API-1", name: "API Product", price: 100,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sku).toBe("API-1");
  });

  it("GET /api/products lists products", async () => {
    await req("POST", "/api/products", { sku: "A", name: "A", price: 1 });
    await req("POST", "/api/products", { sku: "B", name: "B", price: 2 });
    const res = await req("GET", "/api/products");
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it("GET /api/products/:sku returns a product", async () => {
    await req("POST", "/api/products", { sku: "X", name: "X", price: 10 });
    const res = await req("GET", "/api/products/X");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sku).toBe("X");
  });

  it("POST /api/products returns 409 for duplicate SKU", async () => {
    await req("POST", "/api/products", { sku: "DUP", name: "A", price: 1 });
    const res = await req("POST", "/api/products", { sku: "DUP", name: "B", price: 2 });
    expect(res.status).toBe(409);
  });
});

describe("API: stock", () => {
  beforeEach(async () => {
    await req("POST", "/api/products", { sku: "S1", name: "Stock Item", price: 100 });
  });

  it("POST /api/stock/in receives stock", async () => {
    const res = await req("POST", "/api/stock/in", {
      sku: "S1", quantity: 10, warehouse: "Main",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(10);
  });

  it("GET /api/stock/status returns stock levels", async () => {
    await req("POST", "/api/stock/in", { sku: "S1", quantity: 5, warehouse: "Main" });
    const res = await req("GET", "/api/stock/status?sku=S1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].quantity).toBe(5);
  });

  it("POST /api/stock/out returns 409 for insufficient stock", async () => {
    const res = await req("POST", "/api/stock/out", {
      sku: "S1", quantity: 100, warehouse: "Main",
    });
    expect(res.status).toBe(409);
  });
});

describe("API: alerts", () => {
  beforeEach(async () => {
    await req("POST", "/api/products", { sku: "AL1", name: "Alert Item", price: 50 });
  });

  it("POST /api/stock/threshold sets threshold", async () => {
    const res = await req("POST", "/api/stock/threshold", {
      sku: "AL1", warehouse: "Main", min_quantity: 10,
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/stock/alerts returns alerts", async () => {
    await req("POST", "/api/stock/threshold", {
      sku: "AL1", warehouse: "Main", min_quantity: 10,
    });
    const res = await req("GET", "/api/stock/alerts");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].sku).toBe("AL1");
  });
});

describe("API: orders", () => {
  beforeEach(async () => {
    await req("POST", "/api/products", { sku: "O1", name: "Order Item", price: 1000 });
  });

  it("POST /api/orders creates an order", async () => {
    const res = await req("POST", "/api/orders", {
      customer_name: "Test Corp",
      items: [{ sku: "O1", quantity: 2 }],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.customer_name).toBe("Test Corp");
    expect(body.total_amount).toBe(2000);
  });

  it("GET /api/orders lists orders", async () => {
    await req("POST", "/api/orders", {
      customer_name: "X", items: [{ sku: "O1", quantity: 1 }],
    });
    const res = await req("GET", "/api/orders");
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("API: OpenAPI spec", () => {
  it("GET /openapi.json returns valid spec", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe("3.0.3");
    expect(body.info.title).toBe("Inventory Management API");
    expect(body.paths).toBeDefined();
  });
});
