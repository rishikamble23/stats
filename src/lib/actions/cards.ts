"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cardConfigSchema, type CardConfig } from "../cards/types";
import { card, db } from "../db";
import { getSession } from "../session";
import type { ActionResult } from "./connections";

export async function saveCard(input: { id?: string; name: string; config: CardConfig }): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const parsed = cardConfigSchema.safeParse(input.config);
  if (!parsed.success) return { ok: false, error: "That card configuration isn't valid." };
  const name = (input.name || "Untitled card").trim().slice(0, 80);

  if (input.id) {
    const existing = await db.query.card.findFirst({ where: and(eq(card.id, input.id), eq(card.userId, session.user.id)) });
    if (!existing) return { ok: false, error: "Card not found." };
    await db.update(card).set({ name, config: parsed.data }).where(eq(card.id, input.id));
    revalidatePath("/app");
    return { ok: true, data: { id: input.id } };
  }

  const id = crypto.randomUUID();
  await db.insert(card).values({ id, userId: session.user.id, name, config: parsed.data });
  revalidatePath("/app");
  return { ok: true, data: { id } };
}

export async function duplicateCard(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const existing = await db.query.card.findFirst({ where: and(eq(card.id, id), eq(card.userId, session.user.id)) });
  if (!existing) return { ok: false, error: "Card not found." };

  const copyId = crypto.randomUUID();
  const name = `${existing.name.slice(0, 73)} (copy)`;
  await db.insert(card).values({ id: copyId, userId: session.user.id, name, config: existing.config });
  revalidatePath("/app");
  return { ok: true, data: { id: copyId } };
}

export async function deleteCard(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  await db.delete(card).where(and(eq(card.id, id), eq(card.userId, session.user.id)));
  revalidatePath("/app");
  return { ok: true, data: null };
}
