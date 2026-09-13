import { describe, expect, it } from "vitest";
import { describeChange, formatDate, formatValue, niceMilestone } from "@/lib/metrics/format";
import type { MetricResult } from "@/lib/metrics/types";

const result = (value: number, previous: number | null, currency?: string): MetricResult => ({
  value, previous, currency, series: [], granularity: "day",
  period: { from: "2024-01-01", to: "2024-01-30", days: 30 },
  fetchedAt: "2024-01-30T12:00:00Z",
});

describe("formatValue", () => {
  it.each([
    [0, "0"], [99_999, "99,999"], [100_000, "100K"],
    [-99_999, "-99,999"], [-100_000, "-100K"], [1_250_000, "1.3M"],
  ])("formats %s at the compact threshold", (value, expected) => {
    expect(formatValue(value, "number")).toBe(expected);
  });
  it("allows explicit compact and fractional number options", () => {
    expect(formatValue(12_400, "number", undefined, { compact: true })).toBe("12.4K");
    expect(formatValue(100_000, "number", undefined, { compact: false })).toBe("100,000");
    expect(formatValue(12.345, "number", undefined, { maxFractionDigits: 2 })).toBe("12.35");
  });
  it.each([
    [12.34, "usd", "$12.34"], [-12.34, "USD", "-$12.34"], [0, "USD", "$0"],
    [1234.56, "USD", "$1,235"], [12.75, "JPY", "¥13"], [125_000, "USD", "$125K"],
  ])("formats %s %s", (value, currency, expected) => {
    expect(formatValue(value, "currency", currency)).toBe(expected);
  });
  it("defaults to USD and falls back for an invalid currency code", () => {
    expect(formatValue(1.25, "currency")).toBe("$1.25");
    expect(formatValue(1234, "currency", "invalid")).toBe("INVALID 1,234");
    // Unknown but well-formed ISO-style codes are valid Intl input.
    expect(formatValue(12, "currency", "ZZZ")).toBe("ZZZ\u00a012");
  });
  it.each([[12.345, "12.3%"], [-0.25, "-0.3%"], [0, "0%"]])("formats %s percent without rescaling", (value, expected) => {
    expect(formatValue(value, "percent")).toBe(expected);
  });
});

describe("describeChange", () => {
  it("uses absolute level changes and relative flow changes", () => {
    expect(describeChange(result(125, 100), "level", "number", "30d")).toEqual({
      direction: "up", text: "+25", context: "in the last 30 days", percent: 25, absolute: 25,
    });
    expect(describeChange(result(125, 100), "flow", "number", "30d")).toEqual({
      direction: "up", text: "+25%", context: "vs previous 30 days", percent: 25, absolute: 25,
    });
  });
  it.each([
    [95, 100, "−5%", "down", -5], [100, 100, "+0%", "flat", 0],
    [0, 0, "+0", "flat", null], [12, 0, "+12", "up", null],
    [-5, 0, "−5", "down", null], [5, -5, "+10", "up", null],
    [1099, 100, "+999%", "up", 999], [1100, 100, "+1,000", "up", 1000],
  ] as const)("selects the change display for %s versus %s", (value, previous, text, direction, percent) => {
    expect(describeChange(result(value, previous), "flow", "number", "7d")).toEqual({
      text, direction, percent, absolute: value - previous, context: "vs previous 7 days",
    });
  });
  it("rounds small relative changes to one decimal", () => {
    expect(describeChange(result(100.25, 100), "flow", "number", "90d")?.text).toBe("+0.3%");
  });
  it("keeps currency for absolute changes", () => {
    expect(describeChange(result(112.5, 100, "USD"), "level", "currency", "12m")).toEqual({
      direction: "up", text: "+$12.5", context: "in the last 12 months", percent: 12.5, absolute: 12.5,
    });
  });
  it("omits change when the comparison is unknown", () => {
    expect(describeChange(undefined, "level", "number", "30d")).toBeNull();
    expect(describeChange(result(12, null), "flow", "number", "30d")).toBeNull();
  });
});

describe("niceMilestone", () => {
  it.each([
    [0, 0], [9.9, 9], [10, 10], [14.9, 10], [15, 15], [20, 20], [25, 25],
    [30, 30], [40, 40], [50, 50], [74.9, 50], [75, 75], [99, 75],
    [100, 100], [260, 250], [1499, 1000], [1500, 1500], [999_999, 750_000],
  ])("chooses a completed milestone for %s", (value, expected) => {
    expect(niceMilestone(value)).toBe(expected);
  });
});

it("formats calendar dates in UTC across timezones", () => {
  expect(formatDate("2024-01-01")).toBe("Jan 1, 2024");
  expect(formatDate("2024-01-01T00:30:00+05:30")).toBe("Dec 31, 2023");
});
