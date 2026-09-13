import { and, eq } from "drizzle-orm";
import { decryptJson } from "@/lib/crypto";
import { connection, db, ensureMigrated } from "@/lib/db";
import { listUserRepos } from "@/lib/providers/github";
import { requireUser, UnauthorizedError } from "@/lib/session";

/** Repos for the autocomplete in the studio (uses the GitHub connection token or the GitHub login). */
export async function GET() {
  try {
    const user = await requireUser();
    await ensureMigrated();
    const conn = await db.query.connection.findFirst({
      where: and(eq(connection.userId, user.id), eq(connection.provider, "github")),
    });
    const secrets = conn ? decryptJson<Record<string, string>>(conn.secrets) : {};
    const repos = await listUserRepos({ userId: user.id, secrets, config: conn?.config ?? {} }).catch(() => []);
    return Response.json({ repos }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
    return Response.json({ repos: [] });
  }
}
