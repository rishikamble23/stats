import "server-only";
import { createClient as createWebClient } from "@libsql/client/web";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzleWeb } from "drizzle-orm/libsql/web";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { schema } from "./schema";

/**
 * DATABASE_URL takes precedence; TURSO_* are what Vercel's Turso integration
 * injects. Without either we use a local SQLite file.
 */
const url = process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:./data/howitsgoing.db";
const authToken = process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const isLocalFile = url.startsWith("file:") || url.startsWith(":memory:");

export type Db = LibSQLDatabase<typeof schema>;

function createDb(): Db {
  if (!isLocalFile) {
    // Remote libSQL/Turso over HTTP: pure fetch, no native binaries, serverless-safe.
    return drizzleWeb(createWebClient({ url, authToken }), { schema });
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL points at a local file, which doesn't work on Vercel. Set DATABASE_URL (or add the Turso integration, which sets TURSO_DATABASE_URL).",
    );
  }
  if (url.startsWith("file:./data/")) {
    fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  }

  // The embedded SQLite driver ships a native binary. Load it lazily and outside
  // the bundler so serverless deployments never even try to include it.
  const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
  const { createClient } = nodeRequire("@libsql/client") as typeof import("@libsql/client");
  const { drizzle } = nodeRequire("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");
  return drizzle(createClient({ url }), { schema });
}

const globalForDb = globalThis as unknown as {
  __howitsgoingDb?: Db;
  __howitsgoingMigrated?: Promise<void>;
};

export const db: Db = globalForDb.__howitsgoingDb ?? createDb();
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

export * from "./schema";
