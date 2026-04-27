import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { migrate } from "../db/migrate.js";
import { addProduct, listProducts, updateProduct, deleteProduct, getProductBySku } from "../modules/product.js";
import { stockIn, stockOut, getStockStatus, stockTransfer, addWarehouse } from "../modules/stock.js";
import { createOrder, listOrders, updateOrderStatus, type OrderStatus } from "../modules/order.js";
import { setThreshold, getAlerts } from "../modules/alerts.js";
import { importProducts } from "../modules/importer.js";
import { AppError } from "../errors/index.js";
import { openApiSpec } from "./openapi.js";

const API_KEY = process.env.API_KEY ?? "dev-key-12345";

const app = new Hono();

// API Key auth middleware
app.use("/api/*", async (c, next) => {
  const key = c.req.header("X-API-Key");
  if (key !== API_KEY) {
    return c.json({ error: "Unauthorized: invalid or missing X-API-Key" }, 401);
  }
  await next();
});

// Error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    const status = err.name === "NotFoundError" ? 404
      : err.name === "ValidationError" ? 400
      : err.name === "InsufficientStockError" ? 409
      : err.name === "ConflictError" ? 409
      : 500;
    return c.json({ error: err.message }, status);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// OpenAPI spec
app.get("/openapi.json", (c) => c.json(openApiSpec));

// Swagger UI
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// --- Products ---
app.get("/api/products", async (c) => {
  const products = await listProducts();
  return c.json(products);
});

app.get("/api/products/:sku", async (c) => {
  const product = await getProductBySku(c.req.param("sku"));
  if (!product) return c.json({ error: "product not found" }, 404);
  return c.json(product);
});

app.post("/api/products", async (c) => {
  const body = await c.req.json();
  const product = await addProduct(body);
  return c.json(product, 201);
});

app.patch("/api/products/:sku", async (c) => {
  const body = await c.req.json();
  const product = await updateProduct(c.req.param("sku"), body);
  return c.json(product);
});

app.delete("/api/products/:sku", async (c) => {
  await deleteProduct(c.req.param("sku"));
  return c.json({ ok: true });
});

// --- Stock ---
app.post("/api/stock/in", async (c) => {
  const body = await c.req.json();
  const inv = await stockIn(body);
  return c.json(inv);
});

app.post("/api/stock/out", async (c) => {
  const body = await c.req.json();
  const inv = await stockOut(body);
  return c.json(inv);
});

app.get("/api/stock/status", async (c) => {
  const sku = c.req.query("sku");
  const warehouse = c.req.query("warehouse");
  const status = await getStockStatus({ sku, warehouse });
  return c.json(status);
});

app.post("/api/stock/transfer", async (c) => {
  const body = await c.req.json();
  const result = await stockTransfer(body);
  return c.json(result);
});

app.post("/api/stock/warehouse", async (c) => {
  const body = await c.req.json();
  const wh = await addWarehouse(body.name, body.location);
  return c.json(wh, 201);
});

// --- Alerts ---
app.post("/api/stock/threshold", async (c) => {
  const body = await c.req.json();
  const t = await setThreshold(body);
  return c.json(t);
});

app.get("/api/stock/alerts", async (c) => {
  const alerts = await getAlerts();
  return c.json(alerts);
});

// --- Orders ---
app.post("/api/orders", async (c) => {
  const body = await c.req.json();
  const order = await createOrder(body);
  return c.json(order, 201);
});

app.get("/api/orders", async (c) => {
  const status = c.req.query("status") as OrderStatus | undefined;
  const customer_name = c.req.query("customer_name");
  const orders = await listOrders({ status, customer_name });
  return c.json(orders);
});

app.patch("/api/orders/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const order = await updateOrderStatus(id, body.status);
  return c.json(order);
});

// --- Import ---
app.post("/api/import/products", async (c) => {
  const body = await c.req.json();
  if (!body.file) return c.json({ error: "file path required" }, 400);
  const result = await importProducts(body.file);
  return c.json(result);
});

// Start server
async function main() {
  await migrate();
  const port = Number(process.env.PORT ?? 3000);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
  console.log(`OpenAPI spec: http://localhost:${port}/openapi.json`);

  // Use Node.js serve
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port });
}

if (process.env.NODE_ENV !== "test") {
  main().catch(console.error);
}

export { app };
