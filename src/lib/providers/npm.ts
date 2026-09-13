import "server-only";
import { addDays, bucketFlow, periodWindow, previousWindow, sumInWindow, toKey, type DatedValue } from "../metrics/series";
import type { MetricResult } from "../metrics/types";
import { baseResult, ProviderError, request, requireParam, type ServerProvider } from "./base";

interface RangeResponse {
  downloads: { day: string; downloads: number }[];
  package: string;
}

async function range(pkg: string, from: Date, to: Date): Promise<DatedValue[]> {
  const url = `https://api.npmjs.org/downloads/range/${toKey(from)}:${toKey(to)}/${pkg}`;
  const res = await request(url);
  if (res.status === 404) throw new ProviderError(`npm has no package called "${pkg}".`, 404);
  if (!res.ok) throw new ProviderError(`npm responded ${res.status}.`, res.status);
  const data = (await res.json()) as RangeResponse;
  return (data.downloads ?? []).map((d) => ({ date: new Date(`${d.day}T00:00:00Z`), value: d.downloads }));
}

export const npm: ServerProvider = {
  id: "npm",
  async verify() {
    return { label: "npm" };
  },
  async fetch(_ctx, req): Promise<MetricResult> {
    if (req.metric !== "downloads") throw new ProviderError(`Unknown npm metric "${req.metric}".`);
    const pkg = requireParam(req.params, "package", "package name").trim().toLowerCase();
    if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(pkg)) throw new ProviderError("That doesn't look like an npm package name.");

    // npm's counts lag a day, so the window ends yesterday.
    const w = periodWindow(req.period, addDays(new Date(), -1));
    const prev = previousWindow(w);
    const [cur, before] = await Promise.all([range(pkg, w.from, w.to), range(pkg, prev.from, prev.to)]);
    const items = [...before, ...cur];
    return baseResult(w, {
      value: sumInWindow(items, w),
      previous: sumInWindow(items, prev),
      series: bucketFlow(items, w),
    });
  },
};
