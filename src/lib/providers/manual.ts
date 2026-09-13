import "server-only";
import { periodWindow } from "../metrics/series";
import type { MetricResult } from "../metrics/types";
import { baseResult, ProviderError, requireParam, type ServerProvider } from "./base";

/**
 * "Manual" numbers: the value lives in the card's params. History is built up
 * automatically by the snapshot log in the metrics service each time the card
 * is refreshed with a new value.
 */
export const manual: ServerProvider = {
  id: "manual",
  async verify() {
    return { label: "Manual numbers" };
  },
  async fetch(_ctx, req): Promise<MetricResult> {
    if (req.metric !== "value") throw new ProviderError(`Unknown manual metric "${req.metric}".`);
    requireParam(req.params, "label", "label");
    const raw = requireParam(req.params, "value", "value").replace(/[,\s]/g, "");
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new ProviderError("The value must be a number.");
    return baseResult(periodWindow(req.period), { value, series: [] });
  },
};
