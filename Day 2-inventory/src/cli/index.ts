#!/usr/bin/env node
import { Command } from "commander";
import { migrate } from "../db/migrate.js";
import {
  addProduct,
  listProducts,
  updateProduct,
  deleteProduct,
} from "../modules/product.js";
import {
  stockIn,
  stockOut,
  getStockStatus,
} from "../modules/stock.js";
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  type OrderStatus,
} from "../modules/order.js";
import { DEFAULT_WAREHOUSE_NAME } from "../db/schema.js";
import { AppError } from "../errors/index.js";

const program = new Command();
program
  .name("inventory")
  .description("Inventory management CLI")
  .version("0.1.0");

async function ensureMigrated(): Promise<void> {
  await migrate();
}

function fail(err: unknown): never {
  if (err instanceof AppError) {
    console.error(`Error: ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`Unexpected: ${err.message}`);
  } else {
    console.error("Unknown error");
  }
  process.exit(1);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printTable<T>(rows: T[], columns: (keyof T)[]): void {
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  const get = (row: T, key: keyof T): string => {
    const v = (row as Record<string, unknown>)[key as string];
    return v == null ? "" : String(v);
  };
  const headers = columns.map((c) => String(c));
  const widths = headers.map((h, i) => {
    const col = columns[i];
    const maxCell = Math.max(...rows.map((r) => get(r, col).length));
    return Math.max(h.length, maxCell);
  });
  const fmt = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(fmt(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(fmt(columns.map((c) => get(row, c))));
  }
}

const product = program.command("product").description("Product management");

product
  .command("add")
  .requiredOption("--name <name>")
  .requiredOption("--sku <sku>")
  .requiredOption("--price <price>", "price", Number)
  .option("--cost <cost>", "cost", Number)
  .option("--description <description>")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const p = await addProduct({
        sku: opts.sku,
        name: opts.name,
        price: opts.price,
        cost: opts.cost,
        description: opts.description,
      });
      printJson(p);
    } catch (e) {
      fail(e);
    }
  });

product
  .command("list")
  .option("--format <format>", "json or table", "table")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const items = await listProducts();
      if (opts.format === "json") {
        printJson(items);
      } else {
        printTable(items, ["id", "sku", "name", "price", "cost"]);
      }
    } catch (e) {
      fail(e);
    }
  });

product
  .command("update")
  .requiredOption("--sku <sku>")
  .option("--name <name>")
  .option("--price <price>", "price", Number)
  .option("--cost <cost>", "cost", Number)
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const updated = await updateProduct(opts.sku, {
        name: opts.name,
        price: opts.price,
        cost: opts.cost,
      });
      printJson(updated);
    } catch (e) {
      fail(e);
    }
  });

product
  .command("delete")
  .requiredOption("--sku <sku>")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      await deleteProduct(opts.sku);
      console.log(`Deleted ${opts.sku}`);
    } catch (e) {
      fail(e);
    }
  });

const stock = program.command("stock").description("Inventory movements");

stock
  .command("in")
  .requiredOption("--sku <sku>")
  .requiredOption("--quantity <quantity>", "quantity", Number)
  .option("--warehouse <warehouse>", "warehouse name", DEFAULT_WAREHOUSE_NAME)
  .option("--note <note>")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const row = await stockIn({
        sku: opts.sku,
        quantity: opts.quantity,
        warehouse: opts.warehouse,
        note: opts.note,
      });
      printJson(row);
    } catch (e) {
      fail(e);
    }
  });

stock
  .command("out")
  .requiredOption("--sku <sku>")
  .requiredOption("--quantity <quantity>", "quantity", Number)
  .option("--warehouse <warehouse>", "warehouse name", DEFAULT_WAREHOUSE_NAME)
  .option("--note <note>")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const row = await stockOut({
        sku: opts.sku,
        quantity: opts.quantity,
        warehouse: opts.warehouse,
        note: opts.note,
      });
      printJson(row);
    } catch (e) {
      fail(e);
    }
  });

stock
  .command("status")
  .option("--sku <sku>")
  .option("--warehouse <warehouse>")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const rows = await getStockStatus({
        sku: opts.sku,
        warehouse: opts.warehouse,
      });
      printTable(rows, ["sku", "product_name", "warehouse", "quantity"]);
    } catch (e) {
      fail(e);
    }
  });

const order = program.command("order").description("Order management");

function parseItems(
  spec: string,
): { sku: string; quantity: number }[] {
  return spec
    .split(",")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [sku, qtyStr] = chunk.split(":");
      const quantity = Number(qtyStr);
      if (!sku || !Number.isFinite(quantity)) {
        throw new Error(`invalid item spec: "${chunk}" (expected "sku:qty")`);
      }
      return { sku, quantity };
    });
}

order
  .command("create")
  .requiredOption("--customer <customer>")
  .requiredOption("--items <items>", "format: sku:qty,sku:qty")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const o = await createOrder({
        customer_name: opts.customer,
        items: parseItems(opts.items),
      });
      printJson(o);
    } catch (e) {
      fail(e);
    }
  });

order
  .command("list")
  .option("--status <status>")
  .option("--customer <customer>")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const orders = await listOrders({
        status: opts.status as OrderStatus | undefined,
        customer_name: opts.customer,
      });
      if (orders.length === 0) {
        console.log("(no orders)");
        return;
      }
      for (const o of orders) {
        console.log(
          `#${o.id}  ${o.customer_name}  ${o.status}  ¥${o.total_amount}  (${o.items.length} items)`,
        );
      }
    } catch (e) {
      fail(e);
    }
  });

order
  .command("status")
  .requiredOption("--order-id <id>", "order id", Number)
  .requiredOption("--to <status>", "new status")
  .action(async (opts) => {
    try {
      await ensureMigrated();
      const updated = await updateOrderStatus(opts.orderId, opts.to as OrderStatus);
      printJson({
        id: updated.id,
        status: updated.status,
        updated_at: updated.updated_at,
      });
    } catch (e) {
      fail(e);
    }
  });

program.parseAsync(process.argv);
