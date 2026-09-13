import "server-only";
import { and, eq } from "drizzle-orm";
import { account, db } from "../db";
import { levelFromAdditions, levelWindow, periodWindow, type DatedValue } from "../metrics/series";
import type { MetricResult } from "../metrics/types";
import { baseResult, isProviderError, ProviderError, request, requestJson, requireParam, type ConnectionContext, type MetricRequest, type ServerProvider } from "./base";

const API = "https://api.github.com";
const HISTORY_WEEKS_PER_PAGE = 30; // GitHub's maximum
const MAX_HISTORY_PAGES = 4; // 120 weeks; the 12-month window needs 2 pages
const DAY_S = 86_400;

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
  name: string;
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  owner: { login: string; avatar_url: string };
}

interface GitHubUser {
  login: string;
  name: string | null;
  followers: number;
  avatar_url: string;
}

/** GitHub avatars take a size hint; 160px covers a 40px header logo exported at 2×. */
function avatar(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("s", "160");
    return u.toString();
  } catch {
    return url;
  }
}

interface HistoryWeek {
  /** Unix seconds, start of the week (a Sunday). */
  week: number;
  total: number;
  /** Stars added on each day of that week, Sunday first. */
  days: number[];
}

/**
 * Stars added per day, from GitHub's privacy-safe star history endpoint
 * (calendar weeks, newest first, 30 per page). The stargazer list itself has
 * been restricted to a repo's admins since June 2026, so this is the public
 * source of history. Only fetches enough pages to reach `since`.
 */
async function starsPerDay(repo: string, since: Date, token?: string): Promise<DatedValue[]> {
  const weeks = Math.ceil((Date.now() - since.getTime()) / (7 * DAY_S * 1000)) + 2;
  const pages = Math.max(1, Math.min(MAX_HISTORY_PAGES, Math.ceil(weeks / HISTORY_WEEKS_PER_PAGE)));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      gh<HistoryWeek[]>(`/repos/${repo}/stargazers/history?per_page=${HISTORY_WEEKS_PER_PAGE}&page=${i + 1}`, token).catch((err: unknown) => {
        if (isProviderError(err) && err.status === 422) throw new ProviderError("GitHub is throttling star history right now. Try again in a minute.", 429);
        throw err;
      }),
    ),
  );
  const out: DatedValue[] = [];
  for (const week of results.flat()) {
    week.days.forEach((added, day) => {
      if (added > 0) out.push({ date: new Date((week.week + day * DAY_S) * 1000), value: added });
    });
  }
  return out;
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
      const data = await gh<GitHubUser>(`/users/${encodeURIComponent(user)}`, token);
      return baseResult(w, { value: data.followers, series: [], brand: { name: data.name || data.login, logoUrl: avatar(data.avatar_url) } });
    }

    const repo = parseRepo(requireParam(req.params, "repo", "repository"));
    const info = await gh<Repo>(`/repos/${repo}`, token);
    // Cards default to the repo's name and its owner's avatar as the logo.
    const brand = { name: info.name, logoUrl: avatar(info.owner.avatar_url) };

    if (req.metric === "stars") {
      const lw = levelWindow(w);
      const perDay = await starsPerDay(repo, lw.from, token);
      const series = levelFromAdditions(perDay, info.stargazers_count, lw);
      return baseResult(lw, { value: info.stargazers_count, previous: series[0]?.v ?? null, series, brand });
    }

    if (req.metric === "forks") {
      return baseResult(w, { value: info.forks_count, series: [], brand });
    }

    if (req.metric === "release_downloads") {
      const releases = await gh<{ assets: { download_count: number }[] }[]>(`/repos/${repo}/releases?per_page=100`, token);
      const total = releases.reduce((sum, r) => sum + r.assets.reduce((s, a) => s + (a.download_count ?? 0), 0), 0);
      return baseResult(w, { value: total, series: [], brand });
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
