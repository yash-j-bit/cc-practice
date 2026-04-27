import { createClient, type Client } from "@libsql/client";
import { setClient, resetClient } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

export async function createTestDb(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  setClient(db);
  await migrate(db);
  return db;
}

export function closeTestDb(db: Client): void {
  void db.close();
  resetClient();
}
