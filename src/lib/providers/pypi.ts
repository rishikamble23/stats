import "server-only";
import { addDays, bucketFlow, periodWindow, previousWindow, sumInWindow, type DatedValue } from "../metrics/series";
import type { MetricResult } from "../metrics/types";
import { baseResult, ProviderError, request, requireParam, type ServerProvider } from "./base";

interface OverallResponse {
  data: { category: string; date: string; downloads: number }[];
}

export const pypi: ServerProvider = {
  id: "pypi",
  async verify() {
    return { label: "PyPI" };
  },
  async fetch(_ctx, req): Promise<MetricResult> {
    if (req.metric !== "downloads") throw new ProviderError(`Unknown PyPI metric "${req.metric}".`);
    const pkg = requireParam(req.params, "package", "package name").trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(pkg)) throw new ProviderError("That doesn't look like a PyPI package name.");

    const res = await request(`https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/overall?mirrors=false`, {
      headers: { "User-Agent": "howitsgoing" },
    });
    if (res.status === 404) throw new ProviderError(`PyPI has no package called "${pkg}".`, 404);
    if (!res.ok) throw new ProviderError(`pypistats.org responded ${res.status}.`, res.status);
    const data = (await res.json()) as OverallResponse;
    const items: DatedValue[] = (data.data ?? [])
      .filter((d) => d.category === "without_mirrors")
      .map((d) => ({ date: new Date(`${d.date}T00:00:00Z`), value: d.downloads }));

    const w = periodWindow(req.period, addDays(new Date(), -1));
    const prev = previousWindow(w);
    const earliest = items.reduce((min, d) => (d.date < min ? d.date : min), new Date());
    const hasPrev = earliest <= prev.from;
    return baseResult(w, {
      value: sumInWindow(items, w),
      previous: hasPrev ? sumInWindow(items, prev) : null,
      series: bucketFlow(items, w),
      brand: { name: pkg },
      note: w.days > 180 ? "pypistats only keeps 180 days of history." : undefined,
    });
  },
};
