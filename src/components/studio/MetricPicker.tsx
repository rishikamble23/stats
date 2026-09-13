"use client";
import { useEffect, useState } from "react";
import { providerForConnection } from "@/lib/cards/resolve";
import { DEMO_CONNECTION } from "@/lib/metrics/demo";
import type { ClientConnection, MetricRef } from "@/lib/metrics/types";
import { Field, Input, Select } from "../ui";

export type PickerRef = MetricRef & { label?: string };

interface Props {
  value: PickerRef;
  onChange: (next: PickerRef) => void;
  connections: ClientConnection[];
  index?: number;
  onRemove?: () => void;
}

let repoCache: { full_name: string; stargazers_count: number }[] | null = null;

export function MetricPicker({ value, onChange, connections, index, onRemove }: Props) {
  const all = connections.some((c) => c.id === DEMO_CONNECTION.id) ? connections : [...connections, DEMO_CONNECTION];
  const conn = all.find((c) => c.id === value.connectionId);
  const provider = providerForConnection(conn);
  const def = provider?.metrics.find((m) => m.key === value.metric);
  const selectValue = `${value.connectionId}::${value.metric}`;
  const [repos, setRepos] = useState(repoCache);

  const needsRepos = def?.params?.some((p) => p.suggest === "github-repos") && value.connectionId !== "demo";
  useEffect(() => {
    if (!needsRepos || repoCache) return;
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((b) => {
        repoCache = b.repos ?? [];
        setRepos(repoCache);
      })
      .catch(() => setRepos([]));
  }, [needsRepos]);

  return (
    <div className="rounded-2xl border border-line bg-cream-50/60 p-3">
      <div className="flex items-center gap-2">
        {index !== undefined && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-black text-white">{index + 1}</span>}
        <div className="min-w-0 flex-1">
          <Select
            value={selectValue}
            onChange={(e) => {
              const [connectionId, metric] = e.target.value.split("::");
              onChange({ connectionId, metric, params: {}, label: undefined });
            }}
          >
            {all.map((c) => {
              const p = providerForConnection(c);
              if (!p) return null;
              return (
                <optgroup key={c.id} label={`${p.emoji} ${c.label}`}>
                  {p.metrics.map((m) => (
                    <option key={m.key} value={`${c.id}::${m.key}`}>
                      {m.emoji} {m.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="grid size-8 shrink-0 place-items-center rounded-xl text-ink/40 hover:bg-ink/5 hover:text-ink" aria-label="Remove metric">
            <svg viewBox="0 0 20 20" className="size-4" fill="none">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {def?.params?.length ? (
        <div className="mt-3 grid gap-3">
          {def.params.map((p) => (
            <Field key={p.key} label={p.label} help={p.help}>
              {p.type === "select" ? (
                <Select value={value.params?.[p.key] ?? ""} onChange={(e) => onChange({ ...value, params: { ...value.params, [p.key]: e.target.value } })}>
                  <option value="">Choose…</option>
                  {p.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <Input
                    type={p.type === "number" ? "text" : "text"}
                    inputMode={p.type === "number" ? "decimal" : undefined}
                    placeholder={p.placeholder}
                    value={value.params?.[p.key] ?? ""}
                    list={p.suggest === "github-repos" && repos?.length ? `repos-${index ?? 0}` : undefined}
                    onChange={(e) => onChange({ ...value, params: { ...value.params, [p.key]: e.target.value } })}
                    autoComplete="off"
                  />
                  {p.suggest === "github-repos" && repos?.length ? (
                    <datalist id={`repos-${index ?? 0}`}>
                      {repos.map((r) => (
                        <option key={r.full_name} value={r.full_name}>{`⭐ ${r.stargazers_count}`}</option>
                      ))}
                    </datalist>
                  ) : null}
                </>
              )}
            </Field>
          ))}
        </div>
      ) : null}

      {def && (
        <div className="mt-3">
          <Input placeholder={`Label on card (default: ${def.label})`} value={value.label ?? ""} onChange={(e) => onChange({ ...value, label: e.target.value || undefined })} maxLength={60} className="h-9 text-[13px]" />
        </div>
      )}
      {def?.description && <p className="mt-2 text-xs text-ink/50">{def.description}</p>}
    </div>
  );
}
