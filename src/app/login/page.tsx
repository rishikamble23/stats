import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { githubOAuthEnabled } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-20">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back 👋</h1>
          <p className="mt-2 text-sm text-ink/55">Sign in to keep your connections and saved cards.</p>
        </div>
        <LoginForm githubEnabled={githubOAuthEnabled} />
        {!githubOAuthEnabled && (
          <p className="max-w-sm text-center text-xs text-ink/40">
            Tip: set <code className="rounded bg-white px-1 font-mono">GITHUB_CLIENT_ID</code> and <code className="rounded bg-white px-1 font-mono">GITHUB_CLIENT_SECRET</code> to enable one-click GitHub sign-in.
          </p>
        )}
      </main>
    </div>
  );
}
