"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encryptJson } from "../crypto";
import { connection, db } from "../db";
import { getProvider } from "../metrics/catalog";
import type { ClientConnection } from "../metrics/types";
import { getServerProvider, isProviderError } from "../providers";
import { toClientConnection } from "../queries";
import { getSession } from "../session";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createConnection(input: { provider: string; values: Record<string, string> }): Promise<ActionResult<ClientConnection>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const meta = getProvider(input.provider);
  const provider = getServerProvider(input.provider);
  if (!meta || !provider) return { ok: false, error: "Unknown integration." };

  const secrets: Record<string, string> = {};
  const config: Record<string, unknown> = {};
  for (const field of meta.fields) {
    const raw = (input.values?.[field.key] ?? field.defaultValue ?? "").trim();
    if (field.required && !raw) return { ok: false, error: `${field.label} is required.` };
    if (!raw) continue;
    if (field.secret) secrets[field.key] = raw;
    else config[field.key] = raw;
  }

  try {
    const verified = await provider.verify({ userId: session.user.id, secrets, config });
    const row = {
      id: crypto.randomUUID(),
      userId: session.user.id,
      provider: meta.id,
      label: verified.label ?? meta.name,
      secrets: encryptJson(secrets),
      config: { ...config, ...(verified.config ?? {}) },
      status: "ok",
      lastError: null,
      lastSyncedAt: null,
    };
    await db.insert(connection).values(row);
    revalidatePath("/app");
    revalidatePath("/app/connections");
    const inserted = await db.query.connection.findFirst({ where: eq(connection.id, row.id) });
    return { ok: true, data: toClientConnection(inserted!) };
  } catch (err) {
    if (isProviderError(err)) {
      console.warn(`[connections] ${meta.id} verify rejected: ${err.message}`);
      return { ok: false, error: err.message };
    }
    console.error("[connections] verify failed", err);
    return { ok: false, error: "Couldn't verify those credentials. Double-check them and try again." };
  }
}

export async function deleteConnection(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  await db.delete(connection).where(and(eq(connection.id, id), eq(connection.userId, session.user.id)));
  revalidatePath("/app");
  revalidatePath("/app/connections");
  return { ok: true, data: null };
}

export async function renameConnection(id: string, label: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  const clean = label.trim().slice(0, 80);
  if (!clean) return { ok: false, error: "Name can't be empty." };
  await db.update(connection).set({ label: clean }).where(and(eq(connection.id, id), eq(connection.userId, session.user.id)));
  revalidatePath("/app/connections");
  return { ok: true, data: null };
}
