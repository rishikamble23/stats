import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { ensureMigrated } from "./db";

/** Returns the current session or null. Safe to call in RSC, actions, routes. */
export async function getSession() {
  await ensureMigrated();
  return auth.api.getSession({ headers: await headers() });
}

/** Like getSession but redirects to /login when signed out. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** For route handlers / actions: returns the user or throws a 401-ish error. */
export async function requireUser() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session.user;
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor() {
    super("Not signed in");
  }
}
