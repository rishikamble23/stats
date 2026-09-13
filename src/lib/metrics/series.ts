import { PERIODS, type Granularity, type Period, type SeriesPoint } from "./types";

/* ------------------------------------------------------------------ */
/* Dates (all UTC, keys are YYYY-MM-DD)                                 */
/* ------------------------------------------------------------------ */

export function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function startOfUtcDay(d: Date): Date {
  return fromKey(toKey(d));
}

export function weekStart(d: Date): Date {
  const x = startOfUtcDay(d);
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(x, -day);
}

export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function bucketStart(d: Date, g: Granularity): Date {
  if (g === "day") return startOfUtcDay(d);
  if (g === "week") return weekStart(d);
  return monthStart(d);
}

export function nextBucket(d: Date, g: Granularity): Date {
  if (g === "day") return addDays(d, 1);
  if (g === "week") return addDays(d, 7);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export interface Window {
  from: Date;
  to: Date; // inclusive end (today)
  days: number;
  granularity: Granularity;
  period: Period;
}

/** The window a period covers, ending today (UTC). */
export function periodWindow(period: Period, now = new Date()): Window {
  const def = PERIODS.find((p) => p.id === period) ?? PERIODS[1];
  const to = startOfUtcDay(now);
  const from = addDays(to, -(def.days - 1));
  return { from, to, days: def.days, granularity: def.granularity, period: def.id };
}

/** The window immediately before `w` with the same length. */
export function previousWindow(w: Window): Window {
  return { ...w, to: addDays(w.from, -1), from: addDays(w.from, -w.days) };
}

/** All bucket start dates covering the window. */
export function buckets(w: Window): Date[] {
  const out: Date[] = [];
  let cur = bucketStart(w.from, w.granularity);
  while (cur <= w.to) {
    out.push(cur);
    cur = nextBucket(cur, w.granularity);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Series builders                                                      */
/* ------------------------------------------------------------------ */

export interface DatedValue {
  date: Date;
  value: number;
}

/** Sum dated values into zero-filled buckets over the window (flow metrics). */
export function bucketFlow(items: DatedValue[], w: Window): SeriesPoint[] {
  const starts = buckets(w);
  const totals = new Map<string, number>(starts.map((d) => [toKey(d), 0]));
  for (const item of items) {
    if (item.date < w.from || item.date > addDays(w.to, 1)) continue;
    const key = toKey(bucketStart(item.date, w.granularity));
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + item.value);
  }
  return starts.map((d) => ({ t: toKey(d), v: round(totals.get(toKey(d)) ?? 0) }));
}

/** Sum of values inside a window. */
export function sumInWindow(items: DatedValue[], w: Window): number {
  const end = addDays(w.to, 1);
  let total = 0;
  for (const item of items) {
    if (item.date >= w.from && item.date < end) total += item.value;
  }
  return round(total);
}

/**
 * Build a cumulative "level" series from event dates (e.g. star events,
 * customer sign-ups). `total` is the true current total; events may only be a
 * sample, so the last point is pinned to `total`.
 */
export function cumulativeLevel(events: Date[], total: number, w: Window): SeriesPoint[] {
  const sorted = [...events].sort((a, b) => a.getTime() - b.getTime());
  const starts = buckets(w);
  const out: SeriesPoint[] = [];
  let idx = 0;
  let count = 0;
  for (let i = 0; i < starts.length; i++) {
    const end = i === starts.length - 1 ? addDays(w.to, 1) : starts[i + 1];
    while (idx < sorted.length && sorted[idx] < end) {
      idx++;
      count++;
    }
    out.push({ t: toKey(starts[i]), v: count });
  }
  // Events before the window that we didn't see: offset so the end matches total.
  const offset = total - (out.at(-1)?.v ?? 0);
  return out.map((p) => ({ t: p.t, v: p.v + offset }));
}

/**
 * Turn an irregular cumulative curve (points of {date, total}) into a bucketed
 * series over the window by linear interpolation. Used for sampled star history.
 */
export function resampleCumulative(curve: DatedValue[], w: Window): SeriesPoint[] {
  const pts = [...curve].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!pts.length) return [];
  const starts = buckets(w);
  return starts.map((d, i) => {
    const at = i === starts.length - 1 ? addDays(w.to, 1) : nextBucket(d, w.granularity);
    return { t: toKey(d), v: Math.round(valueAt(pts, at)) };
  });
}

/** Linear interpolation of a cumulative curve at a point in time. */
export function valueAt(sorted: DatedValue[], at: Date): number {
  if (!sorted.length) return 0;
  if (at <= sorted[0].date) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (at >= last.date) return last.value;
  let lo = 0;
  let hi = sorted.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].date <= at) lo = mid;
    else hi = mid;
  }
  const a = sorted[lo];
  const b = sorted[hi];
  const span = b.date.getTime() - a.date.getTime();
  if (span <= 0) return b.value;
  const f = (at.getTime() - a.date.getTime()) / span;
  return a.value + (b.value - a.value) * f;
}

/** Fill a daily series (possibly with gaps) into the window's buckets. */
export function fillDaily(points: SeriesPoint[], w: Window, mode: "sum" | "last" = "sum"): SeriesPoint[] {
  const items: DatedValue[] = points.map((p) => ({ date: fromKey(p.t), value: p.v }));
  if (mode === "sum") return bucketFlow(items, w);
  // "last": carry the latest value in each bucket (level metrics reported daily)
  const starts = buckets(w);
  const byBucket = new Map<string, number>();
  const sorted = items.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const it of sorted) byBucket.set(toKey(bucketStart(it.date, w.granularity)), it.value);
  let carry = sorted.find((s) => s.date < w.from)?.value ?? 0;
  return starts.map((d) => {
    const k = toKey(d);
    if (byBucket.has(k)) carry = byBucket.get(k)!;
    return { t: k, v: carry };
  });
}

export function round(n: number, digits = 2): number {
  const m = Math.pow(10, digits);
  return Math.round(n * m) / m;
}

/** Deterministic hash for cache keys. */
export function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
