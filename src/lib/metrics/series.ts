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

/** The window a period covers, ending today (UTC), bucketed for flow metrics (sums). */
export function periodWindow(period: Period, now = new Date()): Window {
  const def = PERIODS.find((p) => p.id === period) ?? PERIODS[1];
  const to = startOfUtcDay(now);
  const from = addDays(to, -(def.days - 1));
  return { from, to, days: def.days, granularity: def.granularity, period: def.id };
}

/** The same window at the finer spacing level metrics (curves) are sampled at. */
export function levelWindow(w: Window): Window {
  const def = PERIODS.find((p) => p.id === w.period) ?? PERIODS[1];
  return { ...w, granularity: def.levelGranularity };
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

export interface Instant {
  /** Series key for the sample (YYYY-MM-DD). */
  t: string;
  /** The moment the level is read. */
  at: Date;
}

/**
 * Where a level series is sampled: the start of every bucket in the window,
 * except that the first sample is clamped to the window start (so the curve
 * begins at the value the change badge compares against) and the last one is
 * taken at the end of the window, i.e. it is the live value.
 */
export function levelInstants(w: Window): Instant[] {
  const starts = buckets(w);
  const last = starts.length - 1;
  return starts.map((d, i) => {
    if (i === last) return { t: toKey(w.to), at: addDays(w.to, 1) };
    const at = d < w.from ? w.from : d;
    return { t: toKey(at), at };
  });
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
 * Level series from the current total and dated additions (stars per day,
 * customer sign-ups, ...). The level at each instant is the total minus every
 * addition at or after it, so the curve always ends at `total`, and additions
 * from before the window (or that were never fetched) fall into the offset.
 */
export function levelFromAdditions(additions: DatedValue[], total: number, w: Window): SeriesPoint[] {
  const sorted = [...additions].sort((a, b) => a.date.getTime() - b.date.getTime());
  let idx = 0;
  let before = 0;
  const cumulative = levelInstants(w).map(({ t, at }) => {
    while (idx < sorted.length && sorted[idx].date < at) {
      before += sorted[idx].value;
      idx++;
    }
    return { t, v: before };
  });
  const offset = total - (cumulative.at(-1)?.v ?? 0);
  return cumulative.map((p) => ({ t: p.t, v: round(p.v + offset) }));
}

/** Level series from event dates where every event adds one (customers, subscribers). */
export function cumulativeLevel(events: Date[], total: number, w: Window): SeriesPoint[] {
  return levelFromAdditions(
    events.map((date) => ({ date, value: 1 })),
    total,
    w,
  );
}

/** Fill a daily series (possibly with gaps) into the window's buckets. */
export function fillDaily(points: SeriesPoint[], w: Window, mode: "sum" | "last" = "sum"): SeriesPoint[] {
  const items: DatedValue[] = points.map((p) => ({ date: fromKey(p.t), value: p.v }));
  if (mode === "sum") return bucketFlow(items, w);
  // "last": a level reported once a day → the latest report on or before each
  // sample. Before the first report there is no history, so hold that value
  // flat instead of starting the curve at zero.
  const sorted = items.sort((a, b) => a.date.getTime() - b.date.getTime());
  let idx = 0;
  let carry = sorted[0]?.value ?? 0;
  return levelInstants(w).map(({ t, at }) => {
    while (idx < sorted.length && sorted[idx].date <= at) {
      carry = sorted[idx].value;
      idx++;
    }
    return { t, v: carry };
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
