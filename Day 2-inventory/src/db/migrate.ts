import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import type { Client } from "@libsql/client";
import { getClient, enableForeignKeys } from "./client.js";
import { SCHEMA_STATEMENTS, DEFAULT_WAREHOUSE_NAME } from "./schema.js";

export async function migrate(db: Client = getClient()): Promise<void> {
  await enableForeignKeys(db);
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.execute(stmt);
  }
  await db.execute({
    sql: "INSERT OR IGNORE INTO warehouses (name, location) VALUES (?, ?)",
    args: [DEFAULT_WAREHOUSE_NAME, "default"],
  });
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    const here = realpathSync(fileURLToPath(import.meta.url));
    const entry = realpathSync(process.argv[1]);
    return here === entry;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  migrate()
    .then(() => {
      console.log("Migration complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
