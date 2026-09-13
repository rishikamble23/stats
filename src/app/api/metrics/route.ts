import type { NextRequest } from "next/server";
import { z } from "zod";
import { fetchMetric } from "@/lib/metrics/service";
import { isProviderError } from "@/lib/providers";
import { requireUser, UnauthorizedError } from "@/lib/session";

// Star history and Stripe pagination can take a while on big accounts.
export const maxDuration = 60;

const querySchema = z.object({
  connectionId: z.string().min(1),
  metric: z.string().min(1),
  period: z.enum(["7d", "30d", "90d", "12m"]).default("30d"),
  params: z.string().optional(),
  refresh: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

    let params: Record<string, string> = {};
    if (parsed.data.params) {
      try {
        const obj = JSON.parse(parsed.data.params);
        if (obj && typeof obj === "object") params = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
      } catch {
        return Response.json({ error: "Bad params" }, { status: 400 });
      }
    }

    const result = await fetchMetric({
      userId: user.id,
      connectionId: parsed.data.connectionId,
      metric: parsed.data.metric,
      params,
      period: parsed.data.period,
      refresh: parsed.data.refresh === "1",
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
    if (isProviderError(err)) return Response.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    console.error("[api/metrics]", err);
    return Response.json({ error: "Something went wrong fetching that metric." }, { status: 500 });
  }
}
