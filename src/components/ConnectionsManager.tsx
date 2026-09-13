"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createConnection, deleteConnection } from "@/lib/actions/connections";
import { PROVIDERS, getProvider } from "@/lib/metrics/catalog";
import type { ClientConnection, ProviderMeta } from "@/lib/metrics/types";
import { Badge, Button, Field, Input, Panel, Select, cn } from "./ui";

export function ConnectionsManager({ connections, initialProvider, githubSignedIn }: { connections: ClientConnection[]; initialProvider?: string; githubSignedIn: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState<ProviderMeta | null>(() => (initialProvider ? (getProvider(initialProvider) ?? null) : null));
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const open = (p: ProviderMeta) => {
    setActive(p);
    setError(null);
    setValues(Object.fromEntries(p.fields.filter((f) => f.defaultValue).map((f) => [f.key, f.defaultValue!])));
  };

  const submit = async (p: ProviderMeta) => {
    setBusy(true);
    setError(null);
    const res = await createConnection({ provider: p.id, values });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setActive(null);
    setValues({});
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this connection? Cards using it will stop loading.")) return;
    setDeleting(id);
    await deleteConnection(id);
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
      <div className="grid gap-6">
        <Panel title="Connected">
          {connections.length === 0 ? (
            <p className="rounded-2xl bg-ink/[0.04] px-4 py-6 text-center text-sm font-semibold text-ink/55">Nothing connected yet. Pick a tool on the right — it takes about a minute.</p>
          ) : (
            <ul className="grid gap-2">
              {connections.map((c) => {
                const p = getProvider(c.provider);
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: p?.color ?? "#eee" }}>
                      {p?.emoji ?? "🔌"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{c.label}</div>
                      <div className="truncate text-xs text-ink/50">{c.status === "error" ? <span className="text-rose-600">{c.lastError}</span> : p?.tagline}</div>
                    </div>
                    <Badge tone={c.status === "error" ? "bad" : "good"}>{c.status === "error" ? "Needs attention" : "Connected"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)} loading={deleting === c.id}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Add a tool">
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
                  active?.id === p.id && "ring-2 ring-ink",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: p.color }}>
                  {p.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-ink/50">{p.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="lg:sticky lg:top-20">
        {active ? (
          <Panel
            title={
              <span className="flex items-center gap-2 normal-case tracking-normal text-ink">
                <span className="text-lg">{active.emoji}</span> Connect {active.name}
              </span>
            }
            action={
              <button type="button" onClick={() => setActive(null)} className="text-xs font-bold text-ink/45 hover:text-ink">
                Close
              </button>
            }
          >
            {active.setupHelp && <p className="mb-4 rounded-2xl bg-cream-100 px-3 py-2.5 text-xs leading-relaxed text-ink/70" dangerouslySetInnerHTML={{ __html: md(active.setupHelp) }} />}
            {active.id === "github" && githubSignedIn && <p className="mb-4 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">You signed in with GitHub, so you can leave the token blank.</p>}
            {active.docsUrl && (
              <a href={active.docsUrl} target="_blank" rel="noreferrer" className="mb-4 inline-block text-xs font-bold text-ink underline decoration-2 underline-offset-2">
                Open {active.name} settings ↗
              </a>
            )}
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(active);
              }}
            >
              {active.fields
                .filter((f) => !(active.id === "posthog" && f.key === "customHost" && values.host !== "custom"))
                .map((f) => (
                  <Field key={f.key} label={f.label} help={f.help}>
                    {f.type === "select" ? (
                      <Select value={values[f.key] ?? f.defaultValue ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "password" ? "password" : "text"}
                        value={values[f.key] ?? ""}
                        placeholder={f.placeholder}
                        required={f.required}
                        autoComplete="off"
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    )}
                  </Field>
                ))}
              {active.instant && <p className="text-sm text-ink/60">No credentials needed — {active.name} data is public. You&apos;ll pick the {active.id === "manual" ? "numbers" : "package"} when making a card.</p>}
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
              <Button type="submit" loading={busy} size="lg" className="mt-1">
                {busy ? "Checking…" : active.instant ? `Add ${active.name}` : `Connect ${active.name}`}
              </Button>
            </form>
          </Panel>
        ) : (
          <div className="rounded-3xl border border-dashed border-line p-6 text-center text-sm font-semibold text-ink/45">Pick a tool to connect it →</div>
        )}
      </div>
    </div>
  );
}

/** Tiny markdown: **bold**, *italic*, `code`. */
function md(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-white px-1 py-0.5 font-mono text-[11px]">$1</code>');
}
