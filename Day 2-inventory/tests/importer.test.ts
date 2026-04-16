import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createTestDb, closeTestDb } from "./helpers.js";
import { parseCsv, importProducts } from "../src/modules/importer.js";
import { listProducts } from "../src/modules/product.js";
import { ValidationError } from "../src/errors/index.js";

let db: Client;
let tmpDir: string;

beforeEach(async () => {
  db = await createTestDb();
  tmpDir = await mkdtemp(join(tmpdir(), "inv-import-"));
});

afterEach(async () => {
  closeTestDb(db);
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeTempCsv(name: string, content: string): Promise<string> {
  const path = join(tmpDir, name);
  await writeFile(path, content);
  return path;
}

describe("parseCsv", () => {
  it("parses header + rows", () => {
    const rows = parseCsv("sku,name,price\nA,Alpha,100\nB,Beta,200");
    expect(rows).toEqual([
      { sku: "A", name: "Alpha", price: "100" },
      { sku: "B", name: "Beta", price: "200" },
    ]);
  });

  it("handles quoted fields with commas", () => {
    const rows = parseCsv('sku,name,price\nA,"Alpha, Big",100');
    expect(rows[0].name).toBe("Alpha, Big");
  });

  it("handles escaped quotes", () => {
    const rows = parseCsv('sku,name,price\nA,"He said ""hi""",100');
    expect(rows[0].name).toBe('He said "hi"');
  });

  it("throws on missing required column", () => {
    expect(() => parseCsv("sku,name\nA,Alpha")).toThrow(ValidationError);
  });

  it("is case-insensitive for headers", () => {
    const rows = parseCsv("SKU,Name,Price\nA,Alpha,100");
    expect(rows[0].sku).toBe("A");
  });
});

describe("importProducts", () => {
  it("imports all rows from a valid CSV", async () => {
    const path = await writeTempCsv(
      "ok.csv",
      "sku,name,price,cost\nA,Alpha,100,50\nB,Beta,200,80",
    );
    const result = await importProducts(path);
    expect(result.total).toBe(2);
    expect(result.ok).toHaveLength(2);
    expect(result.failed).toHaveLength(0);

    const products = await listProducts();
    expect(products.map((p) => p.sku).sort()).toEqual(["A", "B"]);
  });

  it("imports optional description column", async () => {
    const path = await writeTempCsv(
      "desc.csv",
      "sku,name,price,description\nA,Alpha,100,A 16-inch laptop",
    );
    const result = await importProducts(path);
    expect(result.ok[0].description).toBe("A 16-inch laptop");
  });

  it("continues on row errors and reports them", async () => {
    const path = await writeTempCsv(
      "mixed.csv",
      "sku,name,price\nA,Alpha,100\nB,Beta,not-a-number\nC,Gamma,50",
    );
    const result = await importProducts(path);
    expect(result.total).toBe(3);
    expect(result.ok).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].row).toBe(3);
    expect(result.failed[0].sku).toBe("B");
  });

  it("reports duplicate SKU as failed row", async () => {
    const path = await writeTempCsv(
      "dup.csv",
      "sku,name,price\nA,Alpha,100\nA,Alpha again,200",
    );
    const result = await importProducts(path);
    expect(result.ok).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toMatch(/already exists/);
  });

  it("handles empty cost column", async () => {
    const path = await writeTempCsv(
      "empty-cost.csv",
      "sku,name,price,cost\nA,Alpha,100,",
    );
    const result = await importProducts(path);
    expect(result.ok).toHaveLength(1);
    expect(result.ok[0].cost).toBe(0);
  });
});
