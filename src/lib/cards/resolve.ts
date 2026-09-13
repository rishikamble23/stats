import { getProvider } from "../metrics/catalog";
import { DEMO_CONNECTION, DEMO_PROVIDER } from "../metrics/demo";
import { metricRefKey, type ClientConnection, type MetricDef, type MetricResult, type ProviderMeta } from "../metrics/types";
import type { CardConfig, CardSlot } from "./types";

export function providerForConnection(conn: ClientConnection | undefined): ProviderMeta | undefined {
  if (!conn) return undefined;
  if (conn.provider === "demo") return DEMO_PROVIDER;
  return getProvider(conn.provider);
}

export interface MetricState {
  result?: MetricResult;
  loading: boolean;
  error?: string;
}

/** Joins the card's metric refs with connections, catalog definitions and fetched data. */
export function resolveSlots(config: CardConfig, connections: ClientConnection[], data: Record<string, MetricState>): CardSlot[] {
  const all = connections.some((c) => c.id === DEMO_CONNECTION.id) ? connections : [DEMO_CONNECTION, ...connections];
  return config.metrics.map((ref) => {
    const conn = all.find((c) => c.id === ref.connectionId);
    const provider = providerForConnection(conn);
    const def: MetricDef | undefined = provider?.metrics.find((m) => m.key === ref.metric);
    const state = data[metricRefKey(ref, config.period)];
    if (!conn || !provider || !def) {
      return {
        ref,
        def: { key: ref.metric, label: "Missing metric", shortLabel: "Missing", emoji: "❓", format: "number", kind: "level" },
        label: ref.label || "Missing metric",
        error: "This connection was removed",
      };
    }
    return {
      ref,
      def,
      label: ref.label || def.label,
      result: state?.result,
      loading: state?.loading ?? !state,
      error: state?.error,
    };
  });
}

/** True when every required param for the ref is filled in. */
export function refIsComplete(ref: CardConfig["metrics"][number], connections: ClientConnection[]): boolean {
  const all = connections.some((c) => c.id === DEMO_CONNECTION.id) ? connections : [DEMO_CONNECTION, ...connections];
  const conn = all.find((c) => c.id === ref.connectionId);
  const def = providerForConnection(conn)?.metrics.find((m) => m.key === ref.metric);
  if (!def) return false;
  return (def.params ?? []).every((p) => !p.required || (ref.params?.[p.key] ?? "").trim().length > 0);
}
