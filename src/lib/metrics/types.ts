/**
 * Shared, client-safe types for metrics, providers and cards.
 */

export type Period = "7d" | "30d" | "90d" | "12m";

export const PERIODS: { id: Period; label: string; days: number; granularity: Granularity; short: string }[] = [
  { id: "7d", label: "Last 7 days", short: "7 days", days: 7, granularity: "day" },
  { id: "30d", label: "Last 30 days", short: "30 days", days: 30, granularity: "day" },
  { id: "90d", label: "Last 90 days", short: "90 days", days: 90, granularity: "week" },
  { id: "12m", label: "Last 12 months", short: "12 months", days: 365, granularity: "month" },
];

export type Granularity = "day" | "week" | "month";

export type MetricFormat = "number" | "currency" | "percent";

/**
 * level = a number that exists at a point in time (MRR, stars, customers).
 * flow  = a number that accumulates over a window (revenue, downloads, visitors).
 */
export type MetricKind = "level" | "flow";

export interface SeriesPoint {
  /** ISO date, YYYY-MM-DD (bucket start) */
  t: string;
  v: number;
}

export interface MetricResult {
  /** Headline number. */
  value: number;
  /** Comparison value (level: value at window start; flow: previous window sum). */
  previous: number | null;
  /** Chronological series over the requested period. May be empty. */
  series: SeriesPoint[];
  /** ISO 4217 code for currency metrics. */
  currency?: string;
  period: { from: string; to: string; days: number };
  granularity: Granularity;
  fetchedAt: string;
  /** Small caveat shown in the studio (e.g. "MRR history is approximate"). */
  note?: string;
}

export interface ParamDef {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  /** UI hint for autocomplete sources. */
  suggest?: "github-repos";
}

export interface MetricDef {
  key: string;
  /** e.g. "Monthly recurring revenue" */
  label: string;
  /** e.g. "MRR" */
  shortLabel: string;
  emoji: string;
  format: MetricFormat;
  kind: MetricKind;
  description?: string;
  params?: ParamDef[];
  defaultChart?: "area" | "bars";
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** Stored encrypted and never returned to the browser. */
  secret?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export type ProviderId =
  | "github"
  | "stripe"
  | "posthog"
  | "plausible"
  | "npm"
  | "pypi"
  | "lemonsqueezy"
  | "manual"
  | "demo";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  emoji: string;
  tagline: string;
  /** Pastel accent used in the connections UI. */
  color: string;
  fields: FieldDef[];
  metrics: MetricDef[];
  /** Markdown-ish help shown above the connect form. */
  setupHelp?: string;
  docsUrl?: string;
  /** No credentials needed: connecting is a single click. */
  instant?: boolean;
}

/** What the browser is allowed to know about a connection. */
export interface ClientConnection {
  id: string;
  provider: ProviderId;
  label: string;
  config: Record<string, unknown>;
  status: "ok" | "error";
  lastError?: string | null;
  createdAt: string;
}

/** A pointer from a card to one metric on one connection. */
export interface MetricRef {
  connectionId: string;
  metric: string;
  params?: Record<string, string>;
}

export function metricRefKey(ref: MetricRef, period?: Period): string {
  const params = ref.params
    ? Object.keys(ref.params)
        .sort()
        .map((k) => `${k}=${ref.params![k]}`)
        .join("&")
    : "";
  return [ref.connectionId, ref.metric, params, period ?? ""].join("|");
}
