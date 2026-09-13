"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refIsComplete, resolveSlots, type MetricState } from "@/lib/cards/resolve";
import type { CardConfig, CardSlot } from "@/lib/cards/types";
import { demoMetric } from "@/lib/metrics/demo";
import { metricRefKey, type ClientConnection, type MetricRef, type MetricResult, type Period } from "@/lib/metrics/types";

async function fetchRef(ref: MetricRef, period: Period, refresh: boolean): Promise<MetricResult> {
  if (ref.connectionId === "demo") {
    await new Promise((r) => setTimeout(r, refresh ? 350 : 120));
    return demoMetric(ref.metric, period);
  }
  const qs = new URLSearchParams({ connectionId: ref.connectionId, metric: ref.metric, period });
  if (ref.params && Object.keys(ref.params).length) qs.set("params", JSON.stringify(ref.params));
  if (refresh) qs.set("refresh", "1");
  const res = await fetch(`/api/metrics?${qs}`, { credentials: "same-origin" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as MetricResult;
}

/**
 * Loads (and caches in memory) every metric a card needs. Param edits are
 * debounced so typing a repo name doesn't fire a request per keystroke.
 */
export function useCardData(config: CardConfig, connections: ClientConnection[], opts: { debounceMs?: number } = {}) {
  const [data, setData] = useState<Record<string, MetricState>>({});
  const inflight = useRef(new Set<string>());
  const debounceMs = opts.debounceMs ?? 600;

  const load = useCallback(
    async (ref: MetricRef, period: Period, refresh = false) => {
      const key = metricRefKey(ref, period);
      if (inflight.current.has(key)) return;
      inflight.current.add(key);
      setData((d) => ({ ...d, [key]: { ...d[key], loading: true, error: undefined } }));
      try {
        const result = await fetchRef(ref, period, refresh);
        setData((d) => ({ ...d, [key]: { result, loading: false } }));
      } catch (err) {
        setData((d) => ({ ...d, [key]: { result: d[key]?.result, loading: false, error: (err as Error).message } }));
      } finally {
        inflight.current.delete(key);
      }
    },
    [],
  );

  const wanted = useMemo(
    () => config.metrics.filter((ref) => refIsComplete(ref, connections)).map((ref) => ({ ref, key: metricRefKey(ref, config.period) })),
    [config.metrics, config.period, connections],
  );
  const wantedKeys = wanted.map((w) => w.key).join("\n");

  useEffect(() => {
    const missing = wanted.filter((w) => !data[w.key]);
    if (!missing.length) return;
    const timer = setTimeout(() => {
      for (const w of missing) void load(w.ref, config.period);
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKeys]);

  const refresh = useCallback(() => {
    for (const w of wanted) void load(w.ref, config.period, true);
  }, [wanted, config.period, load]);

  const slots: CardSlot[] = useMemo(() => resolveSlots(config, connections, data), [config, connections, data]);
  const loading = slots.some((s) => s.loading);

  return { slots, data, refresh, loading };
}
