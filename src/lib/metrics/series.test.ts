import { describe, expect, it } from "vitest";
import {
  bucketFlow, fillDaily, levelFromAdditions, levelInstants, levelWindow,
  monthStart, periodWindow, previousWindow, sumInWindow, toKey, weekStart,
  type Window,
} from "@/lib/metrics/series";
import type { Granularity } from "@/lib/metrics/types";

const date = (key: string) => new Date(key.includes("T") ? key : `${key}T00:00:00Z`);
const item = (key: string, value: number) => ({ date: date(key), value });
const window = (granularity: Granularity): Window => ({
  from: date("2024-12-31"), to: date("2025-01-02"), days: 3, granularity, period: "7d",
});

describe("UTC windows", () => {
  it.each([
    ["7d", 7, "day", "day", "2024-02-24", "2024-02-17", "2024-02-23"],
    ["30d", 30, "day", "day", "2024-02-01", "2024-01-02", "2024-01-31"],
    ["90d", 90, "week", "day", "2023-12-03", "2023-09-04", "2023-12-02"],
    ["12m", 365, "month", "week", "2023-03-03", "2022-03-03", "2023-03-02"],
  ] as const)("%s includes today and uses an adjacent previous window", (period, days, granularity, levelGranularity, from, prevFrom, prevTo) => {
    const now = date("2024-03-01T23:59:59Z");
    const w = periodWindow(period, now);
    expect(w).toEqual({ period, days, granularity, from: date(from), to: date("2024-03-01") });
    expect(previousWindow(w)).toEqual({ ...w, from: date(prevFrom), to: date(prevTo) });
    expect(levelWindow(w)).toEqual({ ...w, granularity: levelGranularity });
    expect(now.toISOString()).toBe("2024-03-01T23:59:59.000Z");
  });

  it.each([
    ["2023-01-01T23:30:00Z", "2022-12-26", "2023-01-01"],
    ["2024-12-30T12:00:00Z", "2024-12-30", "2024-12-01"],
    ["2025-01-01T00:30:00+05:30", "2024-12-30", "2024-12-01"],
  ])("uses UTC Mondays and month starts for %s", (input, week, month) => {
    expect(toKey(weekStart(date(input)))).toBe(week);
    expect(toKey(monthStart(date(input)))).toBe(month);
  });
});

describe("flow boundaries", () => {
  const values = [
    item("2024-12-30T23:59:59.999Z", 100),
    item("2024-12-31", 1.25), item("2025-01-01", 2.5),
    item("2025-01-02T23:59:59.999Z", 3.25), item("2025-01-03", 1000),
  ];
  it.each([
    ["day", [{ t: "2024-12-31", v: 1.25 }, { t: "2025-01-01", v: 2.5 }, { t: "2025-01-02", v: 3.25 }]],
    ["week", [{ t: "2024-12-30", v: 7 }]],
    ["month", [{ t: "2024-12-01", v: 1.25 }, { t: "2025-01-01", v: 5.75 }]],
  ] as const)("%s buckets exclude midnight after the final day", (granularity, expected) => {
    const w = window(granularity);
    expect(sumInWindow(values, w)).toBe(7);
    expect(bucketFlow(values, w)).toEqual(expected);
  });

  it("zero-fills missing days and sums multiple reports", () => {
    expect(fillDaily([
      { t: "2025-01-02", v: 2 }, { t: "2024-12-31", v: 1 }, { t: "2025-01-02", v: 3 },
    ], window("day"), "sum")).toEqual([
      { t: "2024-12-31", v: 1 }, { t: "2025-01-01", v: 0 }, { t: "2025-01-02", v: 5 },
    ]);
  });

  it("moves Monday midnight into the new week and zero-fills empty weeks", () => {
    const w: Window = { from: date("2024-12-30"), to: date("2025-01-19"), days: 21, granularity: "week", period: "90d" };
    expect(bucketFlow([
      item("2025-01-05T23:59:59.999Z", 2), item("2025-01-06", 3),
    ], w)).toEqual([
      { t: "2024-12-30", v: 2 }, { t: "2025-01-06", v: 3 }, { t: "2025-01-13", v: 0 },
    ]);
  });
});

describe("sparse level history", () => {
  it("clamps the first sample and reads the live value at the end", () => {
    const w: Window = { from: date("2024-12-31"), to: date("2025-01-15"), days: 16, granularity: "week", period: "90d" };
    expect(levelInstants(w)).toEqual([
      { t: "2024-12-31", at: date("2024-12-31") },
      { t: "2025-01-06", at: date("2025-01-06") },
      { t: "2025-01-15", at: date("2025-01-16") },
    ]);
    const additions = [item("2025-01-10", 3), item("2024-12-31", 2), item("2024-12-01", 4)];
    expect(levelFromAdditions(additions, 20, w)).toEqual([
      { t: "2024-12-31", v: 15 }, { t: "2025-01-06", v: 17 }, { t: "2025-01-15", v: 20 },
    ]);
    expect(additions[0].date).toEqual(date("2025-01-10"));
  });

  it("holds the earliest report before history and carries sparse reports forward", () => {
    expect(fillDaily([{ t: "2025-01-02", v: 8 }, { t: "2025-01-01", v: 5 }], window("day"), "last")).toEqual([
      { t: "2024-12-31", v: 5 }, { t: "2025-01-01", v: 5 }, { t: "2025-01-02", v: 8 },
    ]);
  });

  it.each(["sum", "last"] as const)("fills empty %s input with zero", (mode) => {
    expect(fillDaily([], window("day"), mode)).toEqual([
      { t: "2024-12-31", v: 0 }, { t: "2025-01-01", v: 0 }, { t: "2025-01-02", v: 0 },
    ]);
  });
});
