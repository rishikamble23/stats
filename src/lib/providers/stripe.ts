import "server-only";
import Stripe from "stripe";
import { addDays, bucketFlow, buckets, cumulativeLevel, nextBucket, periodWindow, previousWindow, sumInWindow, toKey, type DatedValue, type Window } from "../metrics/series";
import type { MetricResult, SeriesPoint } from "../metrics/types";
import { baseResult, dominantCurrency, fromMinor, monthlyFactor, ProviderError, requireSecret, type ServerProvider } from "./base";

const MAX_RECORDS = 10_000;

function client(secrets: Record<string, string>): Stripe {
  const key = requireSecret(secrets, "apiKey", "API key");
  if (!/^(rk|sk)_(live|test)_/.test(key)) throw new ProviderError("That doesn't look like a Stripe secret or restricted key (rk_live_… / sk_live_…).");
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 25_000 });
}

function friendly(err: unknown): never {
  if (err instanceof ProviderError) throw err;
  const e = err as { type?: string; message?: string; statusCode?: number };
  if (e?.type === "StripeAuthenticationError") throw new ProviderError("Stripe rejected the API key.", 401);
  if (e?.type === "StripePermissionError") throw new ProviderError(`The Stripe key is missing a permission: ${e.message}`, 403);
  throw new ProviderError(e?.message ? `Stripe: ${e.message}` : "Stripe request failed.", e?.statusCode ?? 502);
}

interface SubInfo {
  monthly: number; // in major units of `currency`
  currency: string;
  start: Date;
  end: Date | null;
  active: boolean;
}

async function loadSubscriptions(stripe: Stripe): Promise<SubInfo[]> {
  const subs = await stripe.subscriptions
    .list({ status: "all", limit: 100, expand: ["data.items.data.price", "data.discounts.source.coupon"] })
    .autoPagingToArray({ limit: MAX_RECORDS })
    .catch(friendly);

  return subs.map((s) => {
    let monthly = 0;
    for (const item of s.items.data) {
      const price = item.price;
      if (!price?.recurring) continue;
      const unit = price.unit_amount ?? (price.unit_amount_decimal ? Number(price.unit_amount_decimal) : null);
      if (unit === null) continue; // tiered / metered pricing
      monthly += fromMinor(unit, price.currency) * (item.quantity ?? 1) * monthlyFactor(price.recurring.interval, price.recurring.interval_count);
    }
    for (const d of s.discounts ?? []) {
      if (typeof d === "string") continue;
      const coupon = d.source?.coupon;
      if (!coupon || typeof coupon === "string") continue;
      if (coupon.percent_off) monthly *= 1 - coupon.percent_off / 100;
      else if (coupon.amount_off) monthly = Math.max(0, monthly - fromMinor(coupon.amount_off, coupon.currency ?? s.currency));
    }
    const active = s.status === "active" || s.status === "past_due";
    const endTs = s.ended_at ?? (s.status === "canceled" ? s.canceled_at : null);
    const startTs = s.trial_end && s.trial_end > s.start_date ? s.trial_end : s.start_date;
    return {
      monthly,
      currency: s.currency,
      start: new Date(startTs * 1000),
      end: endTs ? new Date(endTs * 1000) : null,
      active,
    };
  });
}

/** Level series for MRR / subscriber count reconstructed from start/end dates. */
function levelSeries(subs: SubInfo[], w: Window, pick: (s: SubInfo) => number): { series: SeriesPoint[]; previous: number } {
  const at = (t: Date) => {
    let total = 0;
    for (const s of subs) {
      if (s.start <= t && (s.end === null || s.end > t)) total += pick(s);
    }
    return Math.round(total * 100) / 100;
  };
  const starts = buckets(w);
  const series = starts.map((d, i) => {
    const end = i === starts.length - 1 ? addDays(w.to, 1) : nextBucket(d, w.granularity);
    return { t: toKey(d), v: at(end) };
  });
  return { series, previous: at(w.from) };
}

export const stripe: ServerProvider = {
  id: "stripe",
  async verify(ctx) {
    const s = client(ctx.secrets);
    let label = "Stripe";
    try {
      const acct = await s.accounts.retrieve(null);
      const name = acct.settings?.dashboard?.display_name ?? acct.business_profile?.name;
      if (name) label = `Stripe (${name})`;
    } catch {
      // Restricted keys often can't read the account; fall through to a lighter check.
      await s.customers.list({ limit: 1 }).catch(friendly);
    }
    return { label, config: { livemode: ctx.secrets.apiKey.includes("_live_") } };
  },

  async fetch(ctx, req): Promise<MetricResult> {
    const s = client(ctx.secrets);
    const w = periodWindow(req.period);
    const prev = previousWindow(w);

    if (req.metric === "revenue") {
      const since = Math.floor(prev.from.getTime() / 1000);
      const charges = await s.charges
        .list({ created: { gte: since }, limit: 100 })
        .autoPagingToArray({ limit: MAX_RECORDS })
        .catch(friendly);
      const paid = charges.filter((c) => c.status === "succeeded" && c.paid);
      const currency = dominantCurrency(paid.map((c) => c.currency));
      const items: DatedValue[] = paid
        .filter((c) => c.currency.toLowerCase() === currency)
        .map((c) => ({ date: new Date(c.created * 1000), value: fromMinor(c.amount - (c.amount_refunded ?? 0), c.currency) }));
      const mixed = paid.some((c) => c.currency.toLowerCase() !== currency);
      return baseResult(w, {
        value: sumInWindow(items, w),
        previous: sumInWindow(items, prev),
        series: bucketFlow(items, w),
        currency: currency.toUpperCase(),
        note: mixed ? `Only ${currency.toUpperCase()} charges are counted.` : undefined,
      });
    }

    if (req.metric === "mrr" || req.metric === "subscriptions") {
      const subs = await loadSubscriptions(s);
      const currency = dominantCurrency(subs.filter((x) => x.active).map((x) => x.currency));
      const inCurrency = subs.filter((x) => x.currency.toLowerCase() === currency);
      if (req.metric === "mrr") {
        const current = inCurrency.filter((x) => x.active).reduce((a, b) => a + b.monthly, 0);
        const { series, previous } = levelSeries(inCurrency, w, (x) => x.monthly);
        return baseResult(w, {
          value: Math.round(current * 100) / 100,
          previous,
          series: series.map((p, i, arr) => (i === arr.length - 1 ? { ...p, v: Math.round(current * 100) / 100 } : p)),
          currency: currency.toUpperCase(),
          note: "History is reconstructed from subscription start and end dates.",
        });
      }
      const current = inCurrency.filter((x) => x.active).length;
      const { series, previous } = levelSeries(inCurrency, w, () => 1);
      return baseResult(w, { value: current, previous, series });
    }

    if (req.metric === "customers") {
      const customers = await s.customers.list({ limit: 100 }).autoPagingToArray({ limit: MAX_RECORDS }).catch(friendly);
      const dates = customers.map((c) => new Date(c.created * 1000));
      const series = cumulativeLevel(dates, customers.length, w);
      return baseResult(w, {
        value: customers.length,
        previous: series[0] ? series[0].v - dates.filter((d) => d >= w.from && d < nextBucket(w.from, w.granularity)).length : null,
        series,
        note: customers.length >= MAX_RECORDS ? "Showing the first 10,000 customers." : undefined,
      });
    }

    throw new ProviderError(`Unknown Stripe metric "${req.metric}".`);
  },
};
