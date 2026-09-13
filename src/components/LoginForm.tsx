"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Field, Input, Segmented } from "./ui";

export function LoginForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res =
      mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name: name || email.split("@")[0], email, password });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong. Try again.");
      return;
    }
    router.push("/app");
    router.refresh();
  };

  const github = async () => {
    setError(null);
    await authClient.signIn.social({ provider: "github", callbackURL: "/app" });
  };

  return (
    <div className="w-full max-w-sm rounded-[28px] border border-line bg-white/80 p-6 shadow-soft backdrop-blur">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "signin", label: "Sign in" },
          { value: "signup", label: "Create account" },
        ]}
        className="mb-5"
      />

      {githubEnabled && (
        <>
          <Button variant="secondary" size="lg" className="w-full" onClick={github}>
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
            </svg>
            Continue with GitHub
          </Button>
          <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink/35">
            <span className="h-px flex-1 bg-line" />
            or email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="grid gap-3">
        {mode === "signup" && (
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password" help={mode === "signup" ? "At least 8 characters." : undefined}>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-ink/45">
        Your API keys are encrypted at rest and never leave the server.
      </p>
    </div>
  );
}
