import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { setClient, resetClient } from "../src/db/client.js";
import { migrateUp, migrateDown, migrationStatus } from "../src/db/migrator.js";

let db: Client;
let tmpDir: string;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  setClient(db);
  tmpDir = await mkdtemp(join(tmpdir(), "migrations-"));
});

afterEach(async () => {
  db.close();
  resetClient();
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeMigration(name: string, content: string) {
  await writeFile(join(tmpDir, name), content);
}

describe("migrator.migrateUp", () => {
  it("applies all pending migrations in order", async () => {
    await writeMigration("001_init.sql", `-- UP
CREATE TABLE test1 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE test1;`);
    await writeMigration("002_add_col.sql", `-- UP
CREATE TABLE test2 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE test2;`);

    const result = await migrateUp(db, tmpDir);
    expect(result.applied).toEqual([1, 2]);

    // Tables exist
    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test%' ORDER BY name");
    expect(res.rows.map((r) => r.name)).toEqual(["test1", "test2"]);
  });

  it("skips already-applied migrations", async () => {
    await writeMigration("001_init.sql", `-- UP
CREATE TABLE t1 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE t1;`);

    await migrateUp(db, tmpDir);
    const result = await migrateUp(db, tmpDir);
    expect(result.applied).toEqual([]);
  });

  it("records applied version in migration_history", async () => {
    await writeMigration("001_init.sql", `-- UP
CREATE TABLE t1 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE t1;`);

    await migrateUp(db, tmpDir);
    const res = await db.execute("SELECT version, name FROM migration_history");
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].version).toBe(1);
    expect(res.rows[0].name).toBe("init");
  });

  it("rolls back and throws when migration SQL is invalid", async () => {
    await writeMigration("001_bad.sql", `-- UP
CREATE TABLE ok_table (id INTEGER PRIMARY KEY);
INVALID SQL GARBAGE HERE;
-- DOWN
DROP TABLE ok_table;`);

    await expect(migrateUp(db, tmpDir)).rejects.toThrow();

    // Table should NOT exist because the whole migration was rolled back
    const res = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ok_table'",
    );
    expect(res.rows).toHaveLength(0);

    // No version recorded in history
    const hist = await db.execute("SELECT COUNT(*) AS n FROM migration_history");
    expect(Number(hist.rows[0].n)).toBe(0);
  });
});

describe("migrator.migrateDown", () => {
  it("rolls back the latest migration", async () => {
    await writeMigration("001_init.sql", `-- UP
CREATE TABLE t1 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE t1;`);
    await writeMigration("002_extra.sql", `-- UP
CREATE TABLE t2 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE t2;`);

    await migrateUp(db, tmpDir);
    const result = await migrateDown(db, tmpDir);
    expect(result.rolledBack).toEqual([2]);

    // t2 should be gone, t1 should remain
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 't%'");
    expect(tables.rows.map((r) => r.name)).toEqual(["t1"]);
  });

  it("returns empty when nothing to roll back", async () => {
    const result = await migrateDown(db, tmpDir);
    expect(result.rolledBack).toEqual([]);
  });

  it("removes version from migration_history after rollback", async () => {
    await writeMigration("001_init.sql", `-- UP
CREATE TABLE t1 (id INTEGER PRIMARY KEY);
-- DOWN
DROP TABLE t1;`);

    await migrateUp(db, tmpDir);
    await migrateDown(db, tmpDir);
    const res = await db.execute("SELECT COUNT(*) AS n FROM migration_history");
    expect(Number(res.rows[0].n)).toBe(0);
  });

  it("can apply → rollback → re-apply (round-trip)", async () => {
    await writeMigration("001_init.sql", `-- UP
CREATE TABLE roundtrip (id INTEGER PRIMARY KEY, name TEXT);
-- DOWN
DROP TABLE roundtrip;`);

    await migrateUp(db, tmpDir);
    await migrateDown(db, tmpDir);
    const result = await migrateUp(db, tmpDir);
    expect(result.applied).toEqual([1]);

    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='roundtrip'");
    expect(res.rows).toHaveLength(1);
  });

  it("throws when migration has no DOWN section", async () => {
    await writeMigration("001_nope.sql", `-- UP
CREATE TABLE nodown (id INTEGER PRIMARY KEY);`);

    await migrateUp(db, tmpDir);
    await expect(migrateDown(db, tmpDir)).rejects.toThrow(/No DOWN section/);
  });
});

describe("migrator.migrationStatus", () => {
  it("returns empty applied and pending when no migration files exist", async () => {
    const status = await migrationStatus(db, tmpDir);
    expect(status.applied).toEqual([]);
    expect(status.pending).toEqual([]);
  });

  it("shows all as pending when none have been applied", async () => {
    await writeMigration("001_a.sql", "-- UP\nCREATE TABLE sp (id INTEGER PRIMARY KEY);\n-- DOWN\nDROP TABLE sp;");
    const status = await migrationStatus(db, tmpDir);
    expect(status.applied).toEqual([]);
    expect(status.pending).toEqual([1]);
  });

  it("shows applied and pending migrations", async () => {
    await writeMigration("001_a.sql", "-- UP\nCREATE TABLE sa (id INTEGER PRIMARY KEY);\n-- DOWN\nDROP TABLE sa;");
    await writeMigration("002_b.sql", "-- UP\nCREATE TABLE sb (id INTEGER PRIMARY KEY);\n-- DOWN\nDROP TABLE sb;");

    await migrateUp(db, tmpDir);
    await writeMigration("003_c.sql", "-- UP\nCREATE TABLE sc (id INTEGER PRIMARY KEY);\n-- DOWN\nDROP TABLE sc;");

    const status = await migrationStatus(db, tmpDir);
    expect(status.applied).toEqual([1, 2]);
    expect(status.pending).toEqual([3]);
  });
});
