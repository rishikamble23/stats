"use client";
import { THEMES } from "@/lib/cards/themes";
import { cn } from "../ui";

export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {THEMES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            title={t.name}
            aria-label={t.name}
            aria-pressed={selected}
            onClick={() => onChange(t.id)}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 transition hover:bg-ink/[0.04]",
              selected && "bg-ink/[0.05]",
            )}
          >
            <span
              className={cn(
                "block size-11 rounded-full ring-2 ring-offset-2 ring-offset-cream-50 transition-transform group-hover:scale-105",
                selected ? "ring-ink" : "ring-transparent",
              )}
              style={{ background: t.bg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
            />
            <span className={cn("text-[11px] font-bold", selected ? "text-ink" : "text-ink/50")}>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}
