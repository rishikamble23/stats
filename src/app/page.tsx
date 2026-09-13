import Link from "next/link";
import { DemoCard, HeroCards } from "@/components/landing/HeroCards";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { PROVIDERS } from "@/lib/metrics/catalog";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession().catch(() => null);
  const primaryHref = session ? "/app" : "/login";

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button href="/playground" variant="ghost" size="sm">
            Playground
          </Button>
          <Button href={primaryHref} size="sm">
            {session ? "Open my cards" : "Sign in"}
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-ink/60">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Live numbers, zero spreadsheets
            </span>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Show the world
              <br />
              <span className="bg-gradient-to-r from-[#FF7A4D] via-[#F0489E] to-[#7C5CFF] bg-clip-text text-transparent">how it&apos;s going.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/65">
              Connect Stripe, PostHog, GitHub and friends once. Every time you want to post an update, your MRR, active users, stars or downloads are already there — as a cute little card, ready to share.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button href={primaryHref} size="lg">
                {session ? "Open my cards" : "Get started — it's free"}
              </Button>
              <Button href="/playground" size="lg" variant="secondary">
                Try the playground
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-ink/50">
              {PROVIDERS.filter((p) => p.id !== "manual").map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5">
                  <span>{p.emoji}</span> {p.name}
                </span>
              ))}
            </div>
          </div>
          <HeroCards />
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 py-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", emoji: "🔌", title: "Connect once", body: "Paste a read-only API key or sign in with GitHub. Keys are encrypted and never leave the server." },
              { n: "2", emoji: "🎨", title: "Pick a metric & vibe", body: "MRR, actives, stars, downloads… choose a theme, a size and a sticker. Save the card." },
              { n: "3", emoji: "📮", title: "Download, forever", body: "Come back any week: the numbers refresh themselves. One click gives you a crisp PNG for X, LinkedIn or Instagram." },
            ].map((s) => (
              <div key={s.n} className="rounded-[28px] border border-line bg-white/75 p-6 shadow-soft backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-cream-100 text-xl">{s.emoji}</span>
                  <span className="text-xs font-black uppercase tracking-widest text-ink/40">Step {s.n}</span>
                </div>
                <h3 className="mt-4 text-lg font-extrabold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 py-12">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Three layouts. Ten vibes. Zero design work.</h2>
            <p className="mt-2 text-ink/60">Single number, a stack of stats, or a milestone party — every card is 2× retina and sized for socials.</p>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-3">
            <DemoCard
              id="g1"
              config={{ template: "stack", theme: "sky", appName: "Loopnote", emoji: "🌱", metrics: [{ connectionId: "demo", metric: "mrr" }, { connectionId: "demo", metric: "active_users" }, { connectionId: "demo", metric: "signups" }, { connectionId: "demo", metric: "customers" }] }}
            />
            <DemoCard id="g2" config={{ theme: "lemon", appName: "npm: tinyfetch", emoji: "📦", metrics: [{ connectionId: "demo", metric: "downloads" }], chartStyle: "bars", caption: "weekly downloads, last 30 days" }} />
            <DemoCard id="g3" config={{ template: "milestone", theme: "bubblegum", appName: "Pixelfolio", emoji: "🎉", metrics: [{ connectionId: "demo", metric: "customers" }], milestone: { value: 300, message: "300 people pay for something I made?!" } }} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 py-16">
          <div className="rounded-[36px] bg-ink px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your next build-in-public post is 30 seconds away.</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/65">Free and open source. Self-host it or run it locally with a single command.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href={primaryHref} size="lg" variant="light">
                Make my first card
              </Button>
              <Button href="/playground" size="lg" variant="light" className="bg-white/10 text-white hover:bg-white/20 shadow-none">
                Playground
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs font-semibold text-ink/45">
        <span>✦ howitsgoing — progress cards for people who ship</span>
        <div className="flex gap-4">
          <Link href="/playground" className="hover:text-ink">
            Playground
          </Link>
          <a href="https://github.com/suryaprakashpandey/stats" className="hover:text-ink" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
