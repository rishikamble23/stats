import "server-only";
import { bucketFlow, periodWindow, previousWindow, sumInWindow, toKey, type DatedValue } from "../metrics/series";
import type { MetricResult } from "../metrics/types";
import { baseResult, ProviderError, requestJson, requireSecret, type ConnectionContext, type ServerProvider } from "./base";

const METRICS = new Set(["visitors", "pageviews", "visits"]);

function hostOf(config: Record<string, unknown>): string {
  const host = String(config.host ?? "https://plausible.io").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(host)) throw new ProviderError("Enter a valid Plausible URL (starting with https://).");
  return host;
}

function siteOf(config: Record<string, unknown>): string {
  const site = String(config.siteId ?? "").trim();
  if (!site) throw new ProviderError("Plausible site domain is missing.");
  return site;
}

interface QueryResponse {
  results: { metrics: number[]; dimensions: string[] }[];
}

async function query(ctx: ConnectionContext, body: Record<string, unknown>): Promise<QueryResponse> {
  const key = requireSecret(ctx.secrets, "apiKey", "API key");
  return requestJson<QueryResponse>(`${hostOf(ctx.config)}/api/v2/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: siteOf(ctx.config), ...body }),
  });
}

export const plausible: ServerProvider = {
  id: "plausible",
  async verify(ctx) {
    await query(ctx, { metrics: ["visitors"], date_range: "7d" });
    return { label: `Plausible (${siteOf(ctx.config)})` };
  },

  async fetch(ctx, req): Promise<MetricResult> {
    if (!METRICS.has(req.metric)) throw new ProviderError(`Unknown Plausible metric "${req.metric}".`);
    const w = periodWindow(req.period);
    const prev = previousWindow(w);
    const data = await query(ctx, {
      metrics: [req.metric],
      date_range: [toKey(prev.from), toKey(w.to)],
      dimensions: ["time:day"],
    });
    const items: DatedValue[] = data.results.map((r) => ({
      date: new Date(`${r.dimensions[0].slice(0, 10)}T00:00:00Z`),
      value: Number(r.metrics[0]) || 0,
    }));
    return baseResult(w, {
      value: sumInWindow(items, w),
      previous: sumInWindow(items, prev),
      series: bucketFlow(items, w),
    });
  },
};
