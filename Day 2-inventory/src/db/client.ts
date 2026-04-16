import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getClient(): Client {
  if (client) return client;
  const url = process.env.DATABASE_URL ?? "file:inventory.db";
  client = createClient({ url });
  return client;
}

export function setClient(c: Client): void {
  client = c;
}

export function resetClient(): void {
  client = null;
}

export async function withTransaction<T>(
  fn: (db: Client) => Promise<T>,
): Promise<T> {
  const db = getClient();
  await db.execute("BEGIN");
  try {
    const result = await fn(db);
    await db.execute("COMMIT");
    return result;
  } catch (err) {
    await db.execute("ROLLBACK");
    throw err;
  }
}
