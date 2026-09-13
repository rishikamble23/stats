import "server-only";
import { and, eq } from "drizzle-orm";
import { decryptJson } from "../crypto";
import { connection, db, ensureMigrated, metricCache } from "../db";
import { getServerProvider, isProviderError, ProviderError } from "../providers";
import { getMetricDef, getProvider } from "./catalog";
import { fillDaily, hashString, periodWindow, toKey, valueAt } from "./series";
import type { MetricResult, Period, SeriesPoint } from "./types";

const CACHE_TTL_MS = 20 * 60 * 1000;

export interface FetchArgs {
  userId: string;
  connectionId: string;
  metric: string;
  params: Record<string, string>;
  period: Period;
  refresh?: boolean;
}

/**
 * Fetches one metric for one of the user's connections, using a short server
 * cache and a snapshot log that builds history for metrics whose source has none.
 */
export async function fetchMetric(args: FetchArgs): Promise<MetricResult> {
  await ensureMigrated();
  const conn = await db.query.connection.findFirst({
    where: and(eq(connection.id, args.connectionId), eq(connection.userId, args.userId)),
  });
  if (!conn) throw new ProviderError("Connection not found.", 404);

  const meta = getProvider(conn.provider);
  const def = getMetricDef(conn.provider, args.metric);
  const provider = getServerProvider(conn.provider);
  if (!meta || !def || !provider) throw new ProviderError("Unknown metric.", 404);

  const params: Record<string, string> = {};
  for (const p of def.params ?? []) {
    const v = (args.params[p.key] ?? "").trim();
    if (p.required && !v) throw new ProviderError(`Please enter ${p.label.toLowerCase()}.`);
    if (v) params[p.key] = v;
  }

  const cacheKey = `m:${args.metric}:${hashString(JSON.stringify(params))}:${args.period}`;
  if (!args.refresh) {
    const cached = await db.query.metricCache.findFirst({
      where: and(eq(metricCache.connectionId, conn.id), eq(metricCache.cacheKey, cacheKey)),
    });
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return cached.data as MetricResult;
    }
  }

  let result: MetricResult;
  try {
    const secrets = decryptJson<Record<string, string>>(conn.secrets);
    result = await provider.fetch(
      { userId: args.userId, connectionId: conn.id, secrets, config: conn.config },
      { metric: args.metric, params, period: args.period },
    );
  } catch (err) {
    const message = isProviderError(err) ? err.message : (err as Error).message || "Fetch failed";
    await db
      .update(connection)
      .set({ status: "error", lastError: message })
      .where(eq(connection.id, conn.id));
    if (isProviderError(err)) throw err;
    throw new ProviderError(message, 502);
  }

  if (def.kind === "level" && result.series.length === 0) {
    // Manual numbers change their `value` param every time; key the log by label only.
    const identity = conn.provider === "manual" ? { label: params.label ?? "" } : params;
    result = await applySnapshots(conn.id, `s:${args.metric}:${hashString(JSON.stringify(identity))}`, result, args.period);
  }

  await upsertCache(conn.id, cacheKey, result);
  await db
    .update(connection)
    .set({ status: "ok", lastError: null, lastSyncedAt: new Date() })
    .where(eq(connection.id, conn.id));
  return result;
}

/** Keeps one value per day so metrics without history still get a chart over time. */
async function applySnapshots(connectionId: string, key: string, result: MetricResult, period: Period): Promise<MetricResult> {
  const row = await db.query.metricCache.findFirst({
    where: and(eq(metricCache.connectionId, connectionId), eq(metricCache.cacheKey, key)),
  });
  const log: SeriesPoint[] = Array.isArray(row?.data) ? (row!.data as SeriesPoint[]) : [];
  const today = toKey(new Date());
  const idx = log.findIndex((p) => p.t === today);
  if (idx >= 0) log[idx] = { t: today, v: result.value };
  else log.push({ t: today, v: result.value });
  log.sort((a, b) => a.t.localeCompare(b.t));
  await upsertCache(connectionId, key, log);

  const w = periodWindow(period);
  const inWindow = log.filter((p) => p.t >= toKey(w.from));
  const earlier = log.filter((p) => p.t < toKey(w.from));
  if (log.length < 2) return result; // nothing to chart yet
  const series = fillDaily(log, w, "last");
  const curve = log.map((p) => ({ date: new Date(`${p.t}T00:00:00Z`), value: p.v }));
  const previous = earlier.length ? Math.round(valueAt(curve, w.from)) : inWindow[0]?.v ?? null;
  return { ...result, series, previous, note: result.note ?? "History is recorded each time you refresh." };
}

async function upsertCache(connectionId: string, cacheKey: string, data: unknown): Promise<void> {
  const existing = await db.query.metricCache.findFirst({
    where: and(eq(metricCache.connectionId, connectionId), eq(metricCache.cacheKey, cacheKey)),
  });
  if (existing) {
    await db.update(metricCache).set({ data, fetchedAt: new Date() }).where(eq(metricCache.id, existing.id));
  } else {
    await db.insert(metricCache).values({ id: crypto.randomUUID(), connectionId, cacheKey, data, fetchedAt: new Date() });
  }
}
