import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { Studio } from "@/components/studio/Studio";
import { Button } from "@/components/ui";
import { DEMO_CONNECTION } from "@/lib/metrics/demo";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-cream-50/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-bold text-ink/45 sm:block">Playground · sample data</span>
            <Button href="/login" size="sm">
              Sign in
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 pt-6">
        <Studio mode="demo" connections={[DEMO_CONNECTION]} />
      </main>
    </div>
  );
}
