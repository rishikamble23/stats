import type { NextRequest } from "next/server";
import { cleanRepo } from "@/lib/repo-icon";

/**
 * Owner avatar for a GitHub repo, proxied same-origin so <img> stickers stay
 * canvas-safe for PNG export. Public by design: the upstream URL is built
 * server-side from a validated `owner/repo`, so this cannot proxy arbitrary URLs.
 */
export async function GET(request: NextRequest) {
  const repo = cleanRepo(new URL(request.url).searchParams.get("repo"));
  if (!repo) return Response.json({ error: "Use ?repo=owner/name." }, { status: 400 });
  const [owner] = repo.split("/");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(`https://github.com/${owner}.png?size=128`, {
      headers: { "User-Agent": "howitsgoing", Accept: "image/*" },
      signal: controller.signal,
    });
    if (!upstream.ok) return Response.json({ error: "Avatar not found." }, { status: 502 });
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return Response.json({ error: "Couldn't load the avatar." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
