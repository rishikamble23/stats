import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/studio/Studio";
import { getCard, listConnections } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Edit card" };

export default async function EditCardPage({ params }: PageProps<"/app/cards/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  const [card, connections] = await Promise.all([getCard(session.user.id, id), listConnections(session.user.id)]);
  if (!card) notFound();
  return <Studio key={card.id} mode="app" connections={connections} initial={{ id: card.id, name: card.name, config: card.config }} />;
}
