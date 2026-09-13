import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { ConnectionsManager } from "@/components/ConnectionsManager";
import { account, db } from "@/lib/db";
import { listConnections } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage({ searchParams }: PageProps<"/app/connections">) {
  const session = await requireSession();
  const params = await searchParams;
  const add = typeof params.add === "string" ? params.add : undefined;
  const [connections, githubAccount] = await Promise.all([
    listConnections(session.user.id),
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "github")) }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-ink/55">Connect a tool once. Every card built on it stays up to date.</p>
      </div>
      <ConnectionsManager connections={connections} initialProvider={add} githubSignedIn={Boolean(githubAccount?.accessToken)} />
    </div>
  );
}
