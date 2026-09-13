"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteCard } from "@/lib/actions/cards";
import { downloadBlob, renderCardPng, slugify } from "@/lib/cards/export";
import { SIZES, type CardConfig } from "@/lib/cards/types";
import type { ClientConnection } from "@/lib/metrics/types";
import { CardPreview } from "./card/CardPreview";
import { useCardData } from "./card/useCardData";
import { Button } from "./ui";

export interface CardSummary {
  id: string;
  name: string;
  config: CardConfig;
  updatedAt: string;
}

export function CardGrid({ cards, connections }: { cards: CardSummary[]; connections: ClientConnection[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <CardTile key={c.id} card={c} connections={connections} />
      ))}
    </div>
  );
}

function CardTile({ card, connections }: { card: CardSummary; connections: ClientConnection[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const { slots, loading, refresh } = useCardData(card.config, connections, { debounceMs: 0 });
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const size = SIZES[card.config.size];

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const blob = await renderCardPng(ref.current, { width: size.w, height: size.h });
      downloadBlob(blob, `${slugify(card.name || "howitsgoing")}-${new Date().toISOString().slice(0, 10)}.png`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${card.name}"?`)) return;
    setRemoving(true);
    await deleteCard(card.id);
    router.refresh();
  };

  return (
    <div className="group rounded-[28px] border border-line bg-white/75 p-4 shadow-soft backdrop-blur transition hover:-translate-y-0.5">
      <Link href={`/app/cards/${card.id}`} className="block">
        <CardPreview ref={ref} config={card.config} slots={slots} id={`tile-${card.id}`} radius={20} />
      </Link>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{card.name}</div>
          <div className="text-xs text-ink/45">{loading ? "Fetching fresh numbers…" : `Fresh as of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={download} loading={busy} disabled={loading}>
            ⬇︎ PNG
          </Button>
          <Button size="sm" variant="ghost" onClick={refresh} title="Refresh data">
            ↻
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} loading={removing} title="Delete">
            🗑
          </Button>
        </div>
      </div>
    </div>
  );
}
