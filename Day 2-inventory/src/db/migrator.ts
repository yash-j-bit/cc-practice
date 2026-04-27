import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { Client } from "@libsql/client";
import { getClient } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

interface MigrationFile {
  version: number;
  name: string;
  upSql: string;
  downSql: string;
}

const HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS migration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

async function ensureHistoryTable(db: Client): Promise<void> {
  await db.execute(HISTORY_TABLE);
}

async function getAppliedVersions(db: Client): Promise<number[]> {
  const res = await db.execute("SELECT version FROM migration_history ORDER BY version");
  return res.rows.map((r) => Number(r.version));
}

function parseMigrationFile(content: string): { up: string; down: string } {
  const upMarker = "-- UP";
  const downMarker = "-- DOWN";
  const upIdx = content.indexOf(upMarker);
  const downIdx = content.indexOf(downMarker);

  if (upIdx === -1) {
    return { up: content, down: "" };
  }
  if (downIdx === -1) {
    return { up: content.slice(upIdx + upMarker.length).trim(), down: "" };
  }
  return {
    up: content.slice(upIdx + upMarker.length, downIdx).trim(),
    down: content.slice(downIdx + downMarker.length).trim(),
  };
}

async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const files = await readdir(dir);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();
  const migrations: MigrationFile[] = [];

  for (const file of sqlFiles) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;
    const version = Number(match[1]);
    const name = match[2];
    const content = await readFile(join(dir, file), "utf8");
    const { up, down } = parseMigrationFile(content);
    migrations.push({ version, name, upSql: up, downSql: down });
  }

  return migrations;
}

export async function migrateUp(
  db: Client = getClient(),
  dir?: string,
): Promise<{ applied: number[] }> {
  await ensureHistoryTable(db);
  const applied = await getAppliedVersions(db);
  const migrations = await loadMigrations(dir);
  const pending = migrations.filter((m) => !applied.includes(m.version));
  const newlyApplied: number[] = [];

  for (const m of pending) {
    const statements = m.upSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await db.execute("BEGIN");
    try {
      for (const stmt of statements) {
        await db.execute(stmt);
      }
      await db.execute({
        sql: "INSERT INTO migration_history (version, name) VALUES (?, ?)",
        args: [m.version, m.name],
      });
      await db.execute("COMMIT");
      newlyApplied.push(m.version);
    } catch (err) {
      await db.execute("ROLLBACK");
      throw new Error(
        `Migration ${m.version}_${m.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { applied: newlyApplied };
}

export async function migrateDown(
  db: Client = getClient(),
  dir?: string,
): Promise<{ rolledBack: number[] }> {
  await ensureHistoryTable(db);
  const applied = await getAppliedVersions(db);
  if (applied.length === 0) {
    return { rolledBack: [] };
  }

  const latestVersion = Math.max(...applied);
  const migrations = await loadMigrations(dir);
  const migration = migrations.find((m) => m.version === latestVersion);
  if (!migration) {
    throw new Error(`Migration file for version ${latestVersion} not found`);
  }
  if (!migration.downSql) {
    throw new Error(`No DOWN section in migration ${latestVersion}_${migration.name}`);
  }

  const statements = migration.downSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  await db.execute("BEGIN");
  try {
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute({
      sql: "DELETE FROM migration_history WHERE version = ?",
      args: [latestVersion],
    });
    await db.execute("COMMIT");
  } catch (err) {
    await db.execute("ROLLBACK");
    throw new Error(
      `Rollback of ${latestVersion}_${migration.name} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { rolledBack: [latestVersion] };
}

export async function migrationStatus(
  db: Client = getClient(),
  dir?: string,
): Promise<{ applied: number[]; pending: number[] }> {
  await ensureHistoryTable(db);
  const applied = await getAppliedVersions(db);
  const migrations = await loadMigrations(dir);
  const pending = migrations
    .filter((m) => !applied.includes(m.version))
    .map((m) => m.version);
  return { applied, pending };
}

// CLI entry point
if (process.argv[1] && process.argv[1].includes("migrator")) {
  const command = process.argv[2] ?? "up";
  const db = getClient();

  (async () => {
    if (command === "up") {
      const result = await migrateUp(db);
      if (result.applied.length === 0) {
        console.log("No pending migrations.");
      } else {
        console.log(`Applied migrations: ${result.applied.join(", ")}`);
      }
    } else if (command === "down") {
      const result = await migrateDown(db);
      if (result.rolledBack.length === 0) {
        console.log("Nothing to roll back.");
      } else {
        console.log(`Rolled back: ${result.rolledBack.join(", ")}`);
      }
    } else if (command === "status") {
      const result = await migrationStatus(db);
      console.log(`Applied: ${result.applied.join(", ") || "(none)"}`);
      console.log(`Pending: ${result.pending.join(", ") || "(none)"}`);
    } else {
      console.error(`Unknown command: ${command}. Use: up, down, status`);
      process.exit(1);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
