import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:./data/howitsgoing.db";
const authToken = process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  dialect: url.startsWith("file:") ? "sqlite" : "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url, authToken },
});
