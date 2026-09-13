import "server-only";
import type { Window } from "../metrics/series";
import { toKey } from "../metrics/series";
import type { MetricResult, Period, ProviderId, SeriesPoint } from "../metrics/types";

export interface ConnectionContext {
  userId: string;
  connectionId?: string;
  /** Decrypted secret fields (API keys, tokens). */
  secrets: Record<string, string>;
  /** Non-secret config (hosts, project ids, ...). */
  config: Record<string, unknown>;
}

export interface MetricRequest {
  metric: string;
  params: Record<string, string>;
  period: Period;
}

export interface VerifyResult {
  /** Human label for the connection, e.g. "Stripe (Acme Inc)". */
  label?: string;
  /** Extra non-secret config discovered during verification. */
  config?: Record<string, unknown>;
}

export interface ServerProvider {
  id: ProviderId;
  /** Throws ProviderError when credentials don't work. */
  verify(ctx: ConnectionContext): Promise<VerifyResult>;
  fetch(ctx: ConnectionContext, req: MetricRequest): Promise<MetricResult>;
}

/** An error whose message is safe to show to the user. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}

/** fetch() with a timeout and friendlier errors. */
export async function request(url: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new ProviderError("The request timed out. Try again in a moment.", 504);
    throw new ProviderError(`Could not reach ${new URL(url).host}: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function requestJson<T = unknown>(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const res = await request(url, init, timeoutMs);
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message ?? parsed.message ?? parsed.detail ?? parsed.error ?? detail;
      if (typeof detail !== "string") detail = JSON.stringify(detail).slice(0, 200);
    } catch {
      /* not JSON */
    }
    throw new ProviderError(`${new URL(url).host} responded ${res.status}: ${detail}`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError(`${new URL(url).host} returned an unexpected response.`, 502);
  }
}

export function baseResult(
  w: Window,
  partial: Partial<MetricResult> & { value: number; series: SeriesPoint[] },
): MetricResult {
  return {
    previous: null,
    granularity: w.granularity,
    period: { from: toKey(w.from), to: toKey(w.to), days: w.days },
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export function requireParam(params: Record<string, string>, key: string, label = key): string {
  const v = (params[key] ?? "").trim();
  if (!v) throw new ProviderError(`Please enter a ${label}.`);
  return v;
}

export function requireSecret(secrets: Record<string, string>, key: string, label = key): string {
  const v = (secrets[key] ?? "").trim();
  if (!v) throw new ProviderError(`This connection is missing its ${label}. Reconnect it.`);
  return v;
}

export const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

/** Convert a Stripe/LS-style minor-unit amount into major units. */
export function fromMinor(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : amount / 100;
}

/** Most frequent currency in a list (lowercase). */
export function dominantCurrency(codes: string[], fallback = "usd"): string {
  const counts = new Map<string, number>();
  for (const c of codes) counts.set(c.toLowerCase(), (counts.get(c.toLowerCase()) ?? 0) + 1);
  let best = fallback;
  let bestN = 0;
  for (const [c, n] of counts) if (n > bestN) [best, bestN] = [c, n];
  return best;
}

/** Monthly multiplier for a recurring interval. */
export function monthlyFactor(interval: string, count = 1): number {
  const c = Math.max(1, count || 1);
  switch (interval) {
    case "day":
      return 365 / 12 / c;
    case "week":
      return 52 / 12 / c;
    case "month":
      return 1 / c;
    case "year":
      return 1 / (12 * c);
    default:
      return 0;
  }
}
