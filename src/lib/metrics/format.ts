import type { MetricFormat, MetricKind, MetricResult, Period } from "./types";
import { PERIODS } from "./types";

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF", "TWD"]);

/** Big, share-friendly number formatting: 1,204 · 48.2K · 1.3M · $4,210 · $12.4K */
export function formatValue(
  value: number,
  format: MetricFormat,
  currency?: string,
  opts: { compact?: boolean; maxFractionDigits?: number } = {},
): string {
  const compact = opts.compact ?? Math.abs(value) >= 100_000;
  if (format === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
  }
  if (format === "currency") {
    const code = (currency ?? "USD").toUpperCase();
    const fraction = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : Math.abs(value) < 100 && value !== 0 ? 2 : 0;
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : fraction,
        minimumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${code} ${formatValue(value, "number")}`;
    }
  }
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : (opts.maxFractionDigits ?? 0),
  }).format(value);
}

export interface ChangeInfo {
  direction: "up" | "down" | "flat";
  /** e.g. "+18%" or "+212" */
  text: string;
  /** e.g. "vs previous 30 days" */
  context: string;
  percent: number | null;
  absolute: number;
}

/** Describes how the headline changed over the period. Null when unknown. */
export function describeChange(
  result: MetricResult | undefined,
  kind: MetricKind,
  format: MetricFormat,
  period: Period,
): ChangeInfo | null {
  if (!result || result.previous === null || result.previous === undefined) return null;
  const prev = result.previous;
  const abs = result.value - prev;
  const direction = abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  const percent = prev > 0 ? (abs / prev) * 100 : null;
  const periodLabel = PERIODS.find((p) => p.id === period)?.short ?? period;
  const context = kind === "level" ? `in the last ${periodLabel}` : `vs previous ${periodLabel}`;

  // Levels read best as absolute deltas ("+63 stars", "+$1,400"); flows as percentages ("+18%").
  const usePercent = kind === "flow" && percent !== null && Math.abs(percent) < 1000;
  let text: string;
  if (usePercent) {
    const rounded = Math.abs(percent) < 10 ? Math.round(percent * 10) / 10 : Math.round(percent);
    text = `${abs >= 0 ? "+" : "−"}${Math.abs(rounded)}%`;
  } else {
    const absText = formatValue(Math.abs(abs), format, result.currency, { compact: Math.abs(abs) >= 10_000, maxFractionDigits: 0 });
    text = `${abs >= 0 ? "+" : "−"}${absText}`;
  }
  return { direction, text, context, percent, absolute: abs };
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(date);
}

/** "1,000" style milestone: the largest "nice" number <= value. */
export function niceMilestone(value: number): number {
  if (value < 10) return Math.floor(value);
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const candidates = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5].map((m) => m * base).filter((n) => n <= value);
  return candidates.length ? candidates[candidates.length - 1] : base;
}

export function periodLabel(period: Period): string {
  return PERIODS.find((p) => p.id === period)?.label ?? period;
}
