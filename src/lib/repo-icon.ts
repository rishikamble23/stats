/**
 * Client-safe GitHub repo helpers shared by the Studio and the card renderer.
 * The avatar itself is served same-origin via `/api/repo-icon` so card PNG
 * exports never hit cross-origin canvas issues.
 */

/** `owner/repo` from raw input (accepts full github.com URLs too), or null. */
export function cleanRepo(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(cleaned) ? cleaned : null;
}

/** Same-origin avatar URL for a repo's owner. */
export function repoIconUrl(repo: string): string {
  return `/api/repo-icon?repo=${encodeURIComponent(repo)}`;
}

/** First valid `owner/repo` found across metric params (GitHub metrics use `repo`). */
export function firstGithubRepo(metrics: { params?: Record<string, string> }[] | undefined): string | null {
  for (const m of metrics ?? []) {
    const repo = cleanRepo(m.params?.repo);
    if (repo) return repo;
  }
  return null;
}
