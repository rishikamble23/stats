import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import path from "node:path";
import { schema } from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/howitsgoing.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Make sure the default local SQLite directory (./data) exists. Custom file
// URLs are expected to point at an existing directory.
if (url.startsWith("file:./data/")) {
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
}

const globalForDb = globalThis as unknown as {
  __howitsgoingDb?: ReturnType<typeof createDb>;
  __howitsgoingMigrated?: Promise<void>;
};

function createDb() {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export const db = globalForDb.__howitsgoingDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__howitsgoingDb = db;

/**
 * Runs pending migrations exactly once per process. Call this before the
 * first query in any request path (auth handler, route handlers, actions).
 */
export function ensureMigrated(): Promise<void> {
  if (!globalForDb.__howitsgoingMigrated) {
    globalForDb.__howitsgoingMigrated = migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    }).catch((err) => {
      globalForDb.__howitsgoingMigrated = undefined;
      throw err;
    });
  }
  return globalForDb.__howitsgoingMigrated;
}

export type Db = typeof db;
export * from "./schema";
