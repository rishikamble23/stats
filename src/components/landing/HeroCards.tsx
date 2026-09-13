"use client";
import { useMemo } from "react";
import { letterLogo } from "@/lib/cards/logo";
import { resolveSlots, type MetricState } from "@/lib/cards/resolve";
import { defaultCardConfig, type CardConfig } from "@/lib/cards/types";
import { demoMetric } from "@/lib/metrics/demo";
import { metricRefKey } from "@/lib/metrics/types";
import { CardPreview } from "../card/CardPreview";

function demoData(config: CardConfig): Record<string, MetricState> {
  const out: Record<string, MetricState> = {};
  for (const ref of config.metrics) out[metricRefKey(ref, config.period)] = { result: demoMetric(ref.metric, config.period), loading: false };
  return out;
}

export function DemoCard({ config, maxWidth, className, id }: { config: Partial<CardConfig>; maxWidth?: number; className?: string; id: string }) {
  const full = useMemo(() => ({ ...defaultCardConfig(config.metrics ?? [{ connectionId: "demo", metric: "mrr" }]), ...config }), [config]);
  const slots = useMemo(() => resolveSlots(full, [], demoData(full)), [full]);
  return <CardPreview config={full} slots={slots} maxWidth={maxWidth} className={className} id={id} />;
}

export function HeroCards() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[480px]">
      <div className="absolute left-0 top-6 w-[62%] animate-float-slow" style={{ ["--rot" as string]: "-4deg" }}>
        <DemoCard
          id="hero-a"
          config={{ metrics: [{ connectionId: "demo", metric: "mrr" }], theme: "peach", appName: "Pixelfolio", logoUrl: letterLogo("P", "#F97316"), caption: "3 months since launch" }}
        />
      </div>
      <div className="absolute right-0 top-0 w-[58%] animate-float" style={{ ["--rot" as string]: "5deg", animationDelay: "-2s" }}>
        <DemoCard
          id="hero-b"
          config={{ metrics: [{ connectionId: "demo", metric: "stars" }], theme: "midnight", appName: "tinybase", logoUrl: letterLogo("t", "#F5C542", "#1c1917"), emoji: "⭐", template: "milestone", milestone: { value: 2500, message: "Thank you, open source friends 💛" } }}
        />
      </div>
      <div className="absolute bottom-0 left-[18%] w-[64%] animate-float" style={{ ["--rot" as string]: "-1.5deg", animationDelay: "-4s" }}>
        <DemoCard
          id="hero-c"
          config={{ size: "wide", metrics: [{ connectionId: "demo", metric: "active_users" }], theme: "mint", appName: "Loopnote", logoUrl: letterLogo("L", "#10B981"), chartStyle: "area" }}
        />
      </div>
    </div>
  );
}
