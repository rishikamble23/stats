import "server-only";
import { addDays, bucketFlow, buckets, levelFromAdditions, levelWindow, periodWindow, previousWindow, sumInWindow, toKey, type DatedValue, type Window } from "../metrics/series";
import type { MetricResult, SeriesPoint } from "../metrics/types";
import { baseResult, ProviderError, requestJson, requireParam, requireSecret, type ConnectionContext, type ServerProvider } from "./base";

function hostOf(config: Record<string, unknown>): string {
  const host = String(config.host ?? "https://us.posthog.com");
  const custom = String(config.customHost ?? "").trim();
  const chosen = host === "custom" ? custom : host;
  if (!/^https?:\/\//.test(chosen)) throw new ProviderError("Enter a valid PostHog URL (starting with https://).");
  return chosen.replace(/\/+$/, "");
}

function projectOf(config: Record<string, unknown>): string {
  const id = String(config.projectId ?? "").trim();
  if (!id) throw new ProviderError("PostHog project ID is missing.");
  return id;
}

async function hogql(ctx: ConnectionContext, query: string): Promise<unknown[][]> {
  const key = requireSecret(ctx.secrets, "apiKey", "personal API key");
  const url = `${hostOf(ctx.config)}/api/projects/${encodeURIComponent(projectOf(ctx.config))}/query`;
  const data = await requestJson<{ results?: unknown[][]; error?: string }>(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    },
    40_000,
  );
  if (!data.results) throw new ProviderError(data.error ?? "PostHog returned no results.");
  return data.results;
}

const sqlDate = (d: Date) => `toDateTime('${toKey(d)} 00:00:00')`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

function rowsToDated(rows: unknown[][]): DatedValue[] {
  return rows
    .map((r) => ({ date: new Date(String(r[0]).replace(" ", "T").slice(0, 10) + "T00:00:00Z"), value: Number(r[1]) || 0 }))
    .filter((r) => !Number.isNaN(r.date.getTime()));
}

async function distinctUsers(ctx: ConnectionContext, from: Date, to: Date): Promise<number> {
  const rows = await hogql(ctx, `SELECT count(DISTINCT person_id) FROM events WHERE timestamp >= ${sqlDate(from)} AND timestamp < ${sqlDate(to)}`);
  return Number(rows[0]?.[0] ?? 0);
}

async function activeSeries(ctx: ConnectionContext, w: Window, bucket: "day" | "week" | "month"): Promise<SeriesPoint[]> {
  const fn = bucket === "day" ? "toStartOfDay" : bucket === "week" ? "toStartOfWeek" : "toStartOfMonth";
  const rows = await hogql(
    ctx,
    `SELECT ${fn}(timestamp) AS d, count(DISTINCT person_id) FROM events WHERE timestamp >= ${sqlDate(w.from)} AND timestamp < ${sqlDate(addDays(w.to, 1))} GROUP BY d ORDER BY d`,
  );
  const byKey = new Map(rowsToDated(rows).map((r) => [toKey(r.date), r.value]));
  const starts = buckets({ ...w, granularity: bucket });
  // ClickHouse weeks start on Sunday (mode 0); align to whichever key exists.
  return starts.map((d) => {
    const k = toKey(d);
    const alt = toKey(addDays(d, -1));
    return { t: k, v: byKey.get(k) ?? byKey.get(alt) ?? 0 };
  });
}

export const posthog: ServerProvider = {
  id: "posthog",
  async verify(ctx) {
    await hogql(ctx, "SELECT 1");
    let label = `PostHog (project ${projectOf(ctx.config)})`;
    try {
      const key = requireSecret(ctx.secrets, "apiKey");
      const project = await requestJson<{ name?: string }>(`${hostOf(ctx.config)}/api/projects/${encodeURIComponent(projectOf(ctx.config))}/`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (project.name) label = `PostHog (${project.name})`;
    } catch {
      /* project:read scope not granted; fine */
    }
    return { label };
  },

  async fetch(ctx, req): Promise<MetricResult> {
    const w = periodWindow(req.period);
    const prev = previousWindow(w);
    const tomorrow = addDays(w.to, 1);

    if (req.metric === "dau" || req.metric === "wau" || req.metric === "mau") {
      const span = req.metric === "dau" ? 1 : req.metric === "wau" ? 7 : 30;
      const [value, previous, series] = await Promise.all([
        distinctUsers(ctx, addDays(tomorrow, -span), tomorrow),
        distinctUsers(ctx, addDays(tomorrow, -2 * span), addDays(tomorrow, -span)),
        activeSeries(ctx, w, req.metric === "mau" && w.days >= 180 ? "month" : req.metric === "wau" && w.days >= 60 ? "week" : "day"),
      ]);
      const bucket = req.metric === "mau" && w.days >= 180 ? "month" : req.metric === "wau" && w.days >= 60 ? "week" : "day";
      return baseResult(w, {
        value,
        previous,
        series,
        granularity: bucket,
        note: bucket === "day" && req.metric !== "dau" ? "Chart shows daily active users." : undefined,
      });
    }

    if (req.metric === "pageviews" || req.metric === "events") {
      const event = req.metric === "pageviews" ? "$pageview" : requireParam(req.params, "event", "event name");
      const rows = await hogql(
        ctx,
        `SELECT toStartOfDay(timestamp) AS d, count() FROM events WHERE event = '${esc(event)}' AND timestamp >= ${sqlDate(prev.from)} AND timestamp < ${sqlDate(tomorrow)} GROUP BY d ORDER BY d`,
      );
      const items = rowsToDated(rows);
      return baseResult(w, {
        value: sumInWindow(items, w),
        previous: sumInWindow(items, prev),
        series: bucketFlow(items, w),
      });
    }

    if (req.metric === "users") {
      const lw = levelWindow(w);
      const [totalRows, newRows] = await Promise.all([
        hogql(ctx, "SELECT count() FROM persons"),
        hogql(ctx, `SELECT toStartOfDay(created_at) AS d, count() FROM persons WHERE created_at >= ${sqlDate(lw.from)} GROUP BY d ORDER BY d`),
      ]);
      const total = Number(totalRows[0]?.[0] ?? 0);
      // cumulative: the total minus everyone created on or after each sample day
      const series = levelFromAdditions(rowsToDated(newRows), total, lw);
      return baseResult(lw, { value: total, previous: series[0]?.v ?? null, series });
    }

    throw new ProviderError(`Unknown PostHog metric "${req.metric}".`);
  },
};
