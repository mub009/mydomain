"use client";

/** Home page: what NSE Agent Desk does and why it helps, with today's Nifty, Sensex and gold. */
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BellRing, CalendarClock, ChartCandlestick, Check, Coins,
  Database, Globe2, Landmark, LineChart, Link2, LogIn, Menu, Newspaper, ScanSearch, Scale, ShieldAlert, ShieldCheck,
  Smartphone, Sparkles, Target, TrendingDown, Users, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { Logo, ThemeToggle } from "@/components/desk/shell";
import type { AssetBrief, MarketBrief } from "@/lib/market-brief";
import { MIDCAPS, SMALLCAPS } from "@/lib/market/universe";
import { PEOPLE, TEAM } from "@/lib/team";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";

const BENEFITS = [
  { Icon: Target, title: "Clear trade plans", text: "Every pick comes with an entry zone, stop-loss, target, how long to hold and the expected result, so you know the plan before you buy." },
  { Icon: Newspaper, title: "Why the market moved today", text: "A daily brief on why the Nifty 50, Sensex, Bank Nifty and gold went up or down: global markets, crude, the rupee, the dollar and the news." },
  { Icon: TrendingDown, title: "When to sell", text: "Sell check goes through what you hold and says which stocks to keep, trim or exit, for the short term and the long term." },
  { Icon: Sparkles, title: "Improve your portfolio", text: "Tap any holding for the full report and simple tips: add, wait, book profit or balance with gold, silver and other commodity stocks." },
  { Icon: ShieldAlert, title: "Risk checks first", text: "The Black Points and Red Flag agents look for SEBI orders, ASM/GSM lists, promoter pledges, defaults and weak cash flow before anything is picked." },
  { Icon: Landmark, title: "RBI, Fed and world markets", text: "The Central Bank and Macro agents follow interest rates, inflation, crude, USD/INR and Asian and US markets, and say how each one affects your stocks." },
  { Icon: Link2, title: "Your Zerodha accounts", text: "Connect one or many Zerodha accounts, read-only, and see holdings, positions and profit for you and your family in one place." },
  { Icon: BellRing, title: "Position alerts", text: "Track picks in Positions and get alerts when a stop-loss or target is hit, or when the agents change their view." },
  { Icon: Smartphone, title: "Built for your phone", text: "Every page works on a phone: the charts, the agents' chat, the screener and your positions." },
];

const STEPS = [
  { Icon: ScanSearch, who: "Momentum" as const, title: "Scan", text: "Momentum and Trend agents scan Nifty 50, midcap and smallcap stocks for breakouts, volume and strength." },
  { Icon: LineChart, who: "Research" as const, title: "Research", text: "Research and its sub-agents check results, valuation, growth, profit, seasonality and the chart." },
  { Icon: ShieldCheck, who: "BlackPoints" as const, title: "Check the risks", text: "Black Points, Red Flag, Central Bank and Macro agents look for what could go wrong." },
  { Icon: Scale, who: "Decision" as const, title: "Decide", text: "The Decision agent weighs every view, caps each sector and gives the final picks with a full plan." },
];

const SOURCES = [
  "NSE official prices and indices", "BSE Sensex", "Company results and filings", "SEBI orders",
  "NSE ASM / GSM lists", "RBI and US Fed policy", "World indices, gold, crude and USD/INR", "Business news headlines",
];

const AUDIENCE = [
  { Icon: ChartCandlestick, title: "Swing traders", text: "1-10 day momentum ideas with tight stop-losses and clear exit dates." },
  { Icon: CalendarClock, title: "Positional and long-term investors", text: "A long-term view on each stock: quality, growth, value and risk, with what to keep." },
  { Icon: Users, title: "Families", text: "Several Zerodha accounts side by side, with one combined total." },
];

const FAQ = [
  { q: "Is this investment advice?", a: "No. NSE Agent Desk is a research tool. It shows the data and the reasons behind each view so you can decide. We are not a SEBI-registered adviser. Always do your own research or talk to a registered adviser before you invest." },
  { q: "Where does the data come from?", a: "Prices and indices from NSE and BSE through public market data feeds, plus company filings, SEBI orders, RBI and Fed policy, world markets and news headlines. Prices can be delayed." },
  { q: "Can it place orders in my Zerodha account?", a: "No. The Zerodha link is read-only: it reads holdings and positions. It cannot buy, sell or move money. Your Kite secret is stored encrypted." },
  { q: "Which stocks does it cover?", a: `Every share on the NSE's main board. Pick "All NSE" (about 2,000 stocks) or the Nifty 500: a quick scan ranks every stock on trend and momentum, then the agents research the strongest 150 in full. There are also quick lists: the Nifty 50, ${MIDCAPS.length} midcaps and ${SMALLCAPS.length} smallcaps, or your own stocks. You can look up any NSE stock by name or symbol.` },
  { q: "Do I need an account?", a: "You can open the desk and run the research without one. An account keeps your Zerodha links and settings on every device." },
];

const LIVE: { id: AssetBrief["id"]; label: string; tag: string }[] = [
  { id: "nifty", label: "Nifty 50", tag: "NSE" },
  { id: "sensex", label: "Sensex", tag: "BSE" },
  { id: "banknifty", label: "Bank Nifty", tag: "NSE" },
  { id: "gold", label: "Gold", tag: "₹ / 10 g" },
];

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: n >= 1000 ? 0 : 2 });

function LiveCard({ a, label, tag }: { a?: AssetBrief; label: string; tag: string }) {
  const up = (a?.changePct ?? 0) >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-white">{label}</span>
        <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sidebar-muted">{tag}</span>
      </div>
      {a ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <b className="text-[20px] font-bold tabular-nums text-white sm:text-[22px]">{a.unit.startsWith("₹") ? "₹" : ""}{fmt(a.price)}</b>
            <span className={cn("flex items-center text-[13px] font-semibold tabular-nums", up ? "text-emerald-400" : "text-rose-400")}>
              <Arrow className="size-3.5" />{up ? "+" : ""}{a.changePct.toFixed(2)}%
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-sidebar-muted">{a.headline}</p>
        </>
      ) : (
        <div className="mt-2 space-y-2" aria-hidden>
          <div className="h-6 w-28 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [brief, setBrief] = useState<MarketBrief | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const { user, init, ready } = useAuth();

  useEffect(() => { if (!ready) init(); }, [ready, init]);
  useEffect(() => {
    let live = true;
    fetch("/api/market-brief").then((r) => r.ok ? r.json() : Promise.reject())
      .then((b: MarketBrief) => { if (live) setBrief(b); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const find = (id: AssetBrief["id"]) => brief?.assets.find((a) => a.id === id);
  const nav = [["#benefits", "Benefits"], ["#how", "How it works"], ["#markets", "Nifty & Sensex"], ["#faq", "FAQ"]];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--edge)] bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Logo /><b className="truncate text-[16px] font-bold">NSE Agent Desk</b>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {nav.map(([h, l]) => <a key={h} href={h} className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">{l}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {!user && <Link href="/login" className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:block">Log in</Link>}
            <Link href="/dashboard" className="btn-3d-primary hidden items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground sm:flex">
              Open the desk<ArrowRight className="size-4" />
            </Link>
            <button onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open} className="grid size-9 place-items-center rounded-lg hover:bg-muted md:hidden">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-[var(--edge)] px-4 py-3 md:hidden">
            {nav.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[14px] font-medium hover:bg-muted">{l}</a>)}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {!user && <Link href="/login" className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--edge)] py-2.5 text-[14px] font-semibold"><LogIn className="size-4" />Log in</Link>}
              <Link href="/dashboard" className={cn("flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground", user && "col-span-2")}>Open the desk</Link>
            </div>
          </nav>
        )}
      </header>

      {/* hero */}
      <section className="relative overflow-hidden bg-sidebar text-white">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.45),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(16_185_129/0.22),transparent_65%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-20 lg:pb-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-sidebar-foreground">
              <span className="size-1.5 rounded-full bg-emerald-400" />Every NSE stock · Nifty 50, Nifty 500, midcap and smallcap
            </span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-[48px] lg:text-[56px]">
              Research Indian stocks with a team of {PEOPLE.length} AI agents.
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-sidebar-foreground sm:text-[18px]">
              They scan every NSE stock, from the Nifty 50 to small caps, check every risk and explain each pick: where to buy, where to exit, how long to hold, and why the Nifty, Sensex and gold moved today.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="btn-3d-primary flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground">
                Open the desk<ArrowRight className="size-4" />
              </Link>
              {!user && (
                <Link href="/signup" className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10">
                  Create a free account
                </Link>
              )}
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-sidebar-muted">
              {["Free to use", "Reasons for every pick", "Zerodha read-only"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-emerald-400" />{t}</li>
              ))}
            </ul>
          </div>

          {/* live strip */}
          <div id="markets" className="mt-12 scroll-mt-20">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[14px] font-semibold text-white">Today on the NSE and BSE</h2>
              <span className="text-[12px] text-sidebar-muted">
                {failed ? "Market data isn't available right now." : brief ? `${brief.session} · prices may be delayed` : "Loading…"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {LIVE.map((l) => <LiveCard key={l.id} a={find(l.id)} label={l.label} tag={l.tag} />)}
            </div>
            <Link href="/markets" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-300 hover:text-indigo-200">
              Read why the market moved today<ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* numbers */}
      <section className="border-b border-[var(--edge)]">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-8 sm:px-6 md:grid-cols-4">
          {[
            [String(PEOPLE.length), "AI agents working together"],
            ["2,000+", `NSE stocks quick-scanned; the strongest 150 researched in full`],
            ["3-25", "picks per run, with a sector cap"],
            ["Daily", "why Nifty, Sensex and gold moved"],
          ].map(([n, t]) => (
            <div key={t} className="p-3 text-center">
              <dt className="text-[28px] font-extrabold tracking-tight text-primary sm:text-[34px]">{n}</dt>
              <dd className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{t}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* benefits */}
      <section id="benefits" className="scroll-mt-16 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[13px] font-bold uppercase tracking-wider text-primary">Benefits</p>
            <h2 className="mt-2 text-[28px] font-extrabold tracking-tight sm:text-[36px]">Everything you need before you buy, and after.</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">Not just a tip: each idea shows the reasons, the risks and a full plan, and the desk keeps watching your stocks after you buy.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ Icon, title, text }) => (
              <div key={title} className="card rounded-2xl p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                <h3 className="mt-4 text-[16px] font-bold">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-16 border-y border-[var(--edge)] bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[13px] font-bold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mt-2 text-[28px] font-extrabold tracking-tight sm:text-[36px]">Like a research team, in one click.</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">Each agent has one job. They share what they find in a chat you can read, and the Decision agent makes the final call.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ Icon, who, title, text }, i) => (
              <li key={title} className="card relative rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <span className="text-[36px] font-extrabold leading-none text-muted-foreground/25">{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[16px] font-bold">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
                <div className="mt-4 flex items-center gap-2 border-t border-[var(--edge)] pt-3">
                  <AgentAvatar who={who} size={26} /><span className="text-[12.5px] font-medium text-muted-foreground">{TEAM[who].name}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="card mt-6 rounded-2xl p-5">
            <h3 className="text-[14px] font-bold">The whole team</h3>
            <ul className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {PEOPLE.map((p) => (
                <li key={p} className="flex min-w-0 items-center gap-2.5">
                  <AgentAvatar who={p} size={30} />
                  <span className="min-w-0"><b className="block truncate text-[13px] font-semibold">{TEAM[p].name}</b><span className="block truncate text-[11.5px] text-muted-foreground">{TEAM[p].title}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* who + sources */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wider text-primary">Who it&apos;s for</p>
            <h2 className="mt-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]">Traders, investors and families.</h2>
            <ul className="mt-6 space-y-3">
              {AUDIENCE.map(({ Icon, title, text }) => (
                <li key={title} className="card flex gap-4 rounded-2xl p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <span><b className="block text-[15px] font-bold">{title}</b><span className="text-[13.5px] leading-relaxed text-muted-foreground">{text}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wider text-primary">Data you can check</p>
            <h2 className="mt-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]">Built on official sources.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">Every claim links back to where it came from, so you can check it yourself.</p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {SOURCES.map((s) => (
                <li key={s} className="flex items-center gap-2.5 rounded-xl border border-[var(--edge)] px-3.5 py-3 text-[13.5px] font-medium">
                  <BadgeCheck className="size-4 shrink-0 text-emerald-500" />{s}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3 rounded-xl bg-muted/60 p-4 text-[12.5px] leading-relaxed text-muted-foreground">
              <Database className="mt-0.5 size-4 shrink-0" />
              <span>NSE Agent Desk is independent and isn&apos;t linked to, or endorsed by, NSE, BSE, SEBI or Zerodha. Nifty and Sensex are trademarks of their owners.</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-[var(--edge)] bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="text-center text-[13px] font-bold uppercase tracking-wider text-primary">FAQ</p>
          <h2 className="mt-2 text-center text-[28px] font-extrabold tracking-tight sm:text-[34px]">Questions people ask</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <div key={q} className="card rounded-2xl">
                <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold">
                  {q}<span className={cn("text-[20px] leading-none text-muted-foreground transition-transform", faq === i && "rotate-45")}>+</span>
                </button>
                {faq === i && <p className="px-5 pb-5 text-[14px] leading-relaxed text-muted-foreground">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* final call */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-sidebar px-6 py-12 text-center text-white sm:px-12">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.45),transparent_65%)]" />
            <div className="relative">
              <div className="mx-auto mb-5 flex w-fit -space-x-2">
                {PEOPLE.slice(0, 7).map((p) => <AgentAvatar key={p} who={p} size={34} className="rounded-full ring-2 ring-sidebar" />)}
              </div>
              <h2 className="text-[26px] font-extrabold tracking-tight sm:text-[34px]">See today&apos;s picks and why the market moved.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] text-sidebar-foreground">Open the desk, run the agents and read every reason. It takes about a minute.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/dashboard" className="btn-3d-primary flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground">Open the desk<ArrowRight className="size-4" /></Link>
                <Link href="/markets" className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-[15px] font-semibold hover:bg-white/10"><Globe2 className="size-4" />Today&apos;s market brief</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-[var(--edge)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5"><Logo /><b className="text-[15px] font-bold">NSE Agent Desk</b></div>
            <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
              A research tool, not investment advice. We are not a SEBI-registered investment adviser or research analyst. Investments in the securities market are subject to market risks; read all related documents carefully before investing. Past performance does not guarantee future returns.
            </p>
          </div>
          <div>
            <h3 className="text-[13px] font-bold">The desk</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
              {[["/dashboard", "Overview"], ["/markets", "Markets"], ["/screener", "Screener"], ["/positions", "Positions"], ["/watchlist", "Watchlist"], ["/chat", "Agents' chat"]].map(([h, l]) => (
                <li key={h}><Link href={h} className="hover:text-foreground">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[13px] font-bold">Account</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
              {(user ? [["/account", "Account settings"], ["/positions", "My Zerodha accounts"]] : [["/login", "Log in"], ["/signup", "Create an account"]]).map(([h, l]) => (
                <li key={h}><Link href={h} className="hover:text-foreground">{l}</Link></li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Coins className="size-3.5" />Prices in ₹ · times in IST</p>
          </div>
        </div>
        <p className="border-t border-[var(--edge)] py-4 text-center text-[12px] text-muted-foreground">© {new Date().getFullYear()} NSE Agent Desk</p>
      </footer>
    </div>
  );
}
