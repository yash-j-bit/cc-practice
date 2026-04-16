import { readFile } from "node:fs/promises";
import { addProduct, type Product } from "./product.js";
import { ValidationError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export interface ImportResult {
  total: number;
  ok: Product[];
  failed: { row: number; sku: string; error: string }[];
}

const REQUIRED_HEADERS = ["sku", "name", "price"] as const;

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new ValidationError("CSV is empty");
  }
  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new ValidationError(`missing required column: ${required}`);
    }
  }
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else {
      if (c === ',') {
        cells.push(current);
        current = "";
      } else if (c === '"' && current === "") {
        inQuotes = true;
      } else {
        current += c;
      }
    }
  }
  cells.push(current);
  return cells;
}

export async function importProducts(filePath: string): Promise<ImportResult> {
  const content = await readFile(filePath, "utf8");
  const rows = parseCsv(content);
  const result: ImportResult = { total: rows.length, ok: [], failed: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sku = row.sku ?? "";
    try {
      const price = Number(row.price);
      if (!Number.isFinite(price)) {
        throw new ValidationError(`invalid price: "${row.price}"`);
      }
      const cost = row.cost === undefined || row.cost === "" ? undefined : Number(row.cost);
      if (cost !== undefined && !Number.isFinite(cost)) {
        throw new ValidationError(`invalid cost: "${row.cost}"`);
      }
      const product = await addProduct({
        sku,
        name: row.name,
        price,
        cost,
        description: row.description || undefined,
      });
      result.ok.push(product);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push({ row: i + 2, sku, error: msg });
    }
  }

  logger.info("import complete", {
    total: result.total,
    ok: result.ok.length,
    failed: result.failed.length,
  });
  return result;
}

