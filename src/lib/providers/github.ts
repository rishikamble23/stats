import "server-only";
import { and, eq } from "drizzle-orm";
import { account, db } from "../db";
import { periodWindow, resampleCumulative, valueAt, type DatedValue } from "../metrics/series";
import type { MetricResult } from "../metrics/types";
import { baseResult, ProviderError, request, requestJson, requireParam, type ConnectionContext, type MetricRequest, type ServerProvider } from "./base";

const API = "https://api.github.com";
const MAX_HISTORY_PAGES = 14; // ≤ 14 requests per star-history fetch

async function resolveToken(ctx: ConnectionContext): Promise<string | undefined> {
  const own = ctx.secrets.token?.trim();
  if (own) return own;
  // Fall back to the token from "Sign in with GitHub".
  const rows = await db
    .select({ accessToken: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, ctx.userId), eq(account.providerId, "github")))
    .limit(1);
  return rows[0]?.accessToken ?? undefined;
}

function headers(token?: string, accept = "application/vnd.github+json"): HeadersInit {
  const h: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "howitsgoing",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function gh<T>(path: string, token?: string, accept?: string): Promise<T> {
  const res = await request(`${API}${path}`, { headers: headers(token, accept) });
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new ProviderError(
        token
          ? "GitHub rate limit reached. Try again in a bit."
          : "GitHub's anonymous rate limit was hit. Add a personal access token to the connection to raise it.",
        429,
      );
    }
  }
  if (res.status === 404) throw new ProviderError("GitHub couldn't find that. Check the owner/repo spelling (private repos need a token).", 404);
  if (!res.ok) throw new ProviderError(`GitHub responded ${res.status}.`, res.status);
  return (await res.json()) as T;
}

function parseRepo(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(cleaned)) throw new ProviderError("Repository should look like owner/repo.");
  return cleaned;
}

interface Repo {
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
}

async function starHistory(repo: string, total: number, createdAt: string, token?: string): Promise<DatedValue[]> {
  const perPage = 100;
  const pages = Math.min(Math.ceil(total / perPage), 400); // GitHub caps at 40k stars
  if (pages === 0) return [{ date: new Date(createdAt), value: 0 }];

  let pageNumbers: number[];
  if (pages <= MAX_HISTORY_PAGES) {
    pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  } else {
    const step = (pages - 1) / (MAX_HISTORY_PAGES - 1);
    pageNumbers = Array.from(new Set(Array.from({ length: MAX_HISTORY_PAGES }, (_, i) => Math.round(1 + i * step))));
  }

  const curve: DatedValue[] = [{ date: new Date(createdAt), value: 0 }];
  const results = await Promise.all(
    pageNumbers.map((page) =>
      gh<{ starred_at: string }[]>(`/repos/${repo}/stargazers?per_page=${perPage}&page=${page}`, token, "application/vnd.github.star+json").catch(() => []),
    ),
  );
  results.forEach((items, i) => {
    const page = pageNumbers[i];
    items.forEach((item, j) => {
      if (item?.starred_at) curve.push({ date: new Date(item.starred_at), value: (page - 1) * perPage + j + 1 });
    });
  });
  curve.push({ date: new Date(), value: total });
  return curve.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const github: ServerProvider = {
  id: "github",
  async verify(ctx) {
    const token = await resolveToken(ctx);
    if (!token) return { label: "GitHub (public data)", config: { anonymous: true } };
    const me = await gh<{ login: string }>("/user", token);
    return { label: `GitHub (@${me.login})`, config: { login: me.login } };
  },

  async fetch(ctx, req: MetricRequest): Promise<MetricResult> {
    const token = await resolveToken(ctx);
    const w = periodWindow(req.period);

    if (req.metric === "followers") {
      const user = requireParam(req.params, "user", "username").replace(/^@/, "");
      const data = await gh<{ followers: number }>(`/users/${encodeURIComponent(user)}`, token);
      return baseResult(w, { value: data.followers, series: [] });
    }

    const repo = parseRepo(requireParam(req.params, "repo", "repository"));
    const info = await gh<Repo>(`/repos/${repo}`, token);

    if (req.metric === "stars") {
      const curve = await starHistory(repo, info.stargazers_count, info.created_at, token);
      const series = resampleCumulative(curve, w);
      const previous = Math.round(valueAt(curve, w.from));
      return baseResult(w, {
        value: info.stargazers_count,
        previous,
        series,
        note: info.stargazers_count > MAX_HISTORY_PAGES * 100 ? "Star history is sampled." : undefined,
      });
    }

    if (req.metric === "forks") {
      return baseResult(w, { value: info.forks_count, series: [] });
    }

    if (req.metric === "release_downloads") {
      const releases = await gh<{ assets: { download_count: number }[] }[]>(`/repos/${repo}/releases?per_page=100`, token);
      const total = releases.reduce((sum, r) => sum + r.assets.reduce((s, a) => s + (a.download_count ?? 0), 0), 0);
      return baseResult(w, { value: total, series: [] });
    }

    throw new ProviderError(`Unknown GitHub metric "${req.metric}".`);
  },
};

/** Repos the signed-in user can see (for autocomplete). */
export async function listUserRepos(ctx: ConnectionContext): Promise<{ full_name: string; stargazers_count: number }[]> {
  const token = await resolveToken(ctx);
  if (!token) return [];
  const repos = await requestJson<{ full_name: string; stargazers_count: number }[]>(
    `${API}/user/repos?sort=updated&per_page=100&affiliation=owner,organization_member`,
    { headers: headers(token) },
  );
  return repos.map((r) => ({ full_name: r.full_name, stargazers_count: r.stargazers_count }));
}
