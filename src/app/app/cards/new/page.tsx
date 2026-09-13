import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";
import { listConnections } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "New card" };

export default async function NewCardPage() {
  const session = await requireSession();
  const connections = await listConnections(session.user.id);
  return <Studio mode="app" connections={connections} />;
}
