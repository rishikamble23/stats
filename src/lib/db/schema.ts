import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* Better Auth tables (shape matches `@better-auth/cli generate`)      */
/* ------------------------------------------------------------------ */

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* howitsgoing tables                                                  */
/* ------------------------------------------------------------------ */

/**
 * A connection to an external data source (Stripe, PostHog, GitHub, ...).
 * `secrets` is an AES-256-GCM encrypted JSON blob (never sent to the client).
 * `config` is non-secret JSON (e.g. PostHog host + project id, GitHub repo).
 */
export const connection = sqliteTable(
  "connection",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    secrets: text("secrets").notNull().default(""),
    config: text("config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: text("status").notNull().default("ok"),
    lastError: text("last_error"),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("connection_user_id_idx").on(t.userId)],
);

/**
 * Cached metric results so the studio loads instantly and we stay well
 * inside third-party rate limits. One row per (connection, metric, params).
 */
export const metricCache = sqliteTable(
  "metric_cache",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connection.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    data: text("data", { mode: "json" }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("metric_cache_key_idx").on(t.connectionId, t.cacheKey)],
);

/**
 * A saved card design. Re-open it any time and download a fresh image
 * with up-to-date numbers, no re-configuration needed.
 */
export const card = sqliteTable(
  "card",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: text("config", { mode: "json" }).notNull(),
    ...timestamps,
  },
  (t) => [index("card_user_id_idx").on(t.userId)],
);

export const schema = {
  user,
  session,
  account,
  verification,
  connection,
  metricCache,
  card,
};
