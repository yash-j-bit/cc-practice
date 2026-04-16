import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import {
  addProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  getProductBySku,
} from "../src/modules/product.js";
import { NotFoundError, ValidationError, ConflictError } from "../src/errors/index.js";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  closeTestDb(db);
});

describe("product.addProduct", () => {
  it("creates a product with required fields", async () => {
    const p = await addProduct({
      sku: "MBP-2024",
      name: "MacBook Pro",
      price: 248000,
    });
    expect(p.id).toBeGreaterThan(0);
    expect(p.sku).toBe("MBP-2024");
    expect(p.name).toBe("MacBook Pro");
    expect(p.price).toBe(248000);
    expect(p.cost).toBe(0);
  });

  it("creates a product with all optional fields", async () => {
    const p = await addProduct({
      sku: "MBP-2024",
      name: "MacBook Pro",
      price: 248000,
      cost: 180000,
      description: "16-inch laptop",
    });
    expect(p.cost).toBe(180000);
    expect(p.description).toBe("16-inch laptop");
  });

  it("rejects duplicate SKU with ConflictError", async () => {
    await addProduct({ sku: "DUP", name: "A", price: 100 });
    await expect(
      addProduct({ sku: "DUP", name: "B", price: 200 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects negative price with ValidationError", async () => {
    await expect(
      addProduct({ sku: "X", name: "X", price: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty sku with ValidationError", async () => {
    await expect(
      addProduct({ sku: "", name: "X", price: 10 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty name with ValidationError", async () => {
    await expect(
      addProduct({ sku: "X", name: "", price: 10 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("product.listProducts", () => {
  it("returns empty list initially", async () => {
    const products = await listProducts();
    expect(products).toEqual([]);
  });

  it("lists active products", async () => {
    await addProduct({ sku: "A", name: "Alpha", price: 1 });
    await addProduct({ sku: "B", name: "Beta", price: 2 });
    const products = await listProducts();
    expect(products).toHaveLength(2);
    expect(products.map((p) => p.sku).sort()).toEqual(["A", "B"]);
  });

  it("excludes soft-deleted products by default", async () => {
    await addProduct({ sku: "KEEP", name: "Keep", price: 1 });
    await addProduct({ sku: "GONE", name: "Gone", price: 1 });
    await deleteProduct("GONE");
    const products = await listProducts();
    expect(products.map((p) => p.sku)).toEqual(["KEEP"]);
  });

  it("includes deleted products when includeDeleted=true", async () => {
    await addProduct({ sku: "GONE", name: "Gone", price: 1 });
    await deleteProduct("GONE");
    const products = await listProducts({ includeDeleted: true });
    expect(products).toHaveLength(1);
    expect(products[0].deleted_at).not.toBeNull();
  });
});

describe("product.updateProduct", () => {
  it("updates name and price", async () => {
    await addProduct({ sku: "U1", name: "Old", price: 100 });
    const updated = await updateProduct("U1", {
      name: "New",
      price: 200,
    });
    expect(updated.name).toBe("New");
    expect(updated.price).toBe(200);
  });

  it("partial updates leave other fields intact", async () => {
    await addProduct({ sku: "U2", name: "Keep", price: 100, cost: 50 });
    const updated = await updateProduct("U2", { price: 150 });
    expect(updated.name).toBe("Keep");
    expect(updated.price).toBe(150);
    expect(updated.cost).toBe(50);
  });

  it("throws NotFoundError for unknown SKU", async () => {
    await expect(
      updateProduct("MISSING", { price: 10 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects update with no fields", async () => {
    await addProduct({ sku: "U3", name: "X", price: 1 });
    await expect(updateProduct("U3", {})).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects negative price", async () => {
    await addProduct({ sku: "U4", name: "X", price: 1 });
    await expect(
      updateProduct("U4", { price: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("product.deleteProduct", () => {
  it("soft-deletes a product", async () => {
    await addProduct({ sku: "D1", name: "X", price: 1 });
    await deleteProduct("D1");
    const fetched = await getProductBySku("D1", { includeDeleted: true });
    expect(fetched?.deleted_at).not.toBeNull();
  });

  it("throws NotFoundError for unknown SKU", async () => {
    await expect(deleteProduct("NOPE")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when deleting already-deleted product", async () => {
    await addProduct({ sku: "D2", name: "X", price: 1 });
    await deleteProduct("D2");
    await expect(deleteProduct("D2")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("product.getProductBySku", () => {
  it("returns product when present", async () => {
    await addProduct({ sku: "G1", name: "X", price: 1 });
    const p = await getProductBySku("G1");
    expect(p?.sku).toBe("G1");
  });

  it("returns null when missing", async () => {
    const p = await getProductBySku("NOPE");
    expect(p).toBeNull();
  });

  it("excludes soft-deleted by default", async () => {
    await addProduct({ sku: "G2", name: "X", price: 1 });
    await deleteProduct("G2");
    const p = await getProductBySku("G2");
    expect(p).toBeNull();
  });
});
