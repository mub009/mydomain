"use client";

import { Briefcase, CandlestickChart, LayoutDashboard, MessagesSquare, Moon, SlidersHorizontal, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { PEOPLE, TEAM } from "@/lib/team";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type Presence, useDesk, usePresence } from "@/store/desk";
import { usePositions, useUnreadAlerts } from "@/store/positions";
import { AgentAvatar, PRESENCE_TEXT } from "./agent-avatar";
import { MarketStatusBadge, TypingIndicator } from "./primitives";
import { AlertsBell, AlertToasts } from "./positions-ui";
import { StockDrawer } from "./stock-drawer";

const NAV = [
  { href: "/", label: "Overview", Icon: LayoutDashboard },
  { href: "/chat", label: "Team Chat", Icon: MessagesSquare },
  { href: "/screener", label: "Screener", Icon: SlidersHorizontal },
  { href: "/positions", label: "Positions", Icon: Briefcase },
];

export function Logo() {
  return (
    <span className="grid size-9 place-items-center rounded-xl bg-primary text-white shadow-sm"><CandlestickChart className="size-5" /></span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn("grid size-8 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground", className)}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/** AgentStatusCard: avatar, name, role, live status and latest message. */
export function AgentStatusCard({ who, presence, lastMessage }: { who: Person; presence: Presence; lastMessage?: string }) {
  const t = TEAM[who];
  const sub = Boolean(t.lead);
  return (
    <div className={cn("flex gap-2.5 rounded-xl p-2 transition-colors", presence === "Typing" && "bg-sidebar-hover",
      sub && "ml-5 rounded-l-none border-l border-sidebar-border py-1.5 pl-2.5")}>
      <AgentAvatar who={who} size={sub ? 30 : 38} presence={presence} ringClass="ring-sidebar" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13.5px] font-semibold text-white">{t.name}</span>
          <span className={cn("flex shrink-0 items-center gap-1 text-[10.5px] font-semibold", PRESENCE_TEXT[presence])}>
            {presence}{presence === "Typing" && <TypingIndicator />}
          </span>
        </div>
        <div className="text-[11.5px] text-sidebar-muted">{t.title}</div>
        <div className={cn("mt-0.5 text-[11.5px] leading-snug text-sidebar-foreground/75", sub ? "line-clamp-1" : "line-clamp-2")}>{lastMessage ?? t.focus}</div>
      </div>
    </div>
  );
}

function useUnread() {
  const pathname = usePathname();
  return useDesk((s) => (pathname === "/chat" ? 0 : Math.max(0, s.messages.slice(0, s.shown).length - (s.seen.all ?? 0))));
}

function Sidebar() {
  const pathname = usePathname();
  const alertsUnread = useUnreadAlerts();
  const presence = usePresence();
  const unread = useUnread();
  const messages = useDesk((s) => s.messages);
  const shown = useDesk((s) => s.shown);
  const last = (p: Person) => [...messages.slice(0, shown)].reverse().find((m) => m.sender === p)?.text;
  return (
    <aside className="sticky top-0 hidden h-dvh w-[250px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <Link href="/" className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
        <Logo />
        <span><b className="block text-[15px] font-bold leading-tight text-white">NSE Agent Desk</b><span className="text-[11.5px] text-sidebar-muted">AI stock research team</span></span>
      </Link>
      <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => {
          const on = pathname === href;
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                on ? "bg-primary text-white shadow-sm" : "hover:bg-sidebar-hover hover:text-white")}>
              <Icon className="size-4" />{label}
              {href === "/positions" && alertsUnread > 0 && <span className="ml-auto rounded-full bg-neg px-1.5 text-[11px] font-bold leading-[18px] text-white tnum">{alertsUnread}</span>}
              {href === "/chat" && unread > 0 && <span className="ml-auto rounded-full bg-white/20 px-1.5 text-[11px] font-bold leading-[18px] text-white tnum">{unread}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-widest text-sidebar-muted">AI Trading Team</div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 scroll-thin">
        {PEOPLE.map((p) => <AgentStatusCard key={p} who={p} presence={presence[p]} lastMessage={last(p)} />)}
      </div>
      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] leading-snug text-sidebar-muted">
        Research tool only, not investment advice.
        <Link href="/components" className="mt-1 block underline-offset-2 hover:text-white hover:underline">Component showcase</Link>
      </div>
    </aside>
  );
}

function MobileBars() {
  const pathname = usePathname();
  const alertsUnread = useUnreadAlerts();
  const unread = useUnread();
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-sidebar px-3 py-2 text-white lg:hidden">
        <Logo />
        <b className="text-sm font-bold">NSE Agent Desk</b>
        <div className="ml-auto flex items-center gap-2"><MarketStatusBadge className="h-7 border-sidebar-border bg-sidebar-hover px-2 text-[11px] text-white [&>span:last-child]:hidden min-[420px]:[&>span:last-child]:inline" /><AlertsBell className="border-sidebar-border bg-sidebar-hover text-white" /><ThemeToggle className="border-sidebar-border bg-sidebar-hover text-white" /></div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => {
          const on = pathname === href;
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", on ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />{label}
              {href === "/positions" && alertsUnread > 0 && <span className="absolute right-[calc(50%-22px)] top-1.5 rounded-full bg-neg px-1.5 text-[10px] font-bold leading-4 text-white">{alertsUnread}</span>}
              {href === "/chat" && unread > 0 && <span className="absolute right-[calc(50%-22px)] top-1.5 rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-white">{unread}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const loadConfig = useDesk((s) => s.loadConfig);
  const loadPositions = usePositions((s) => s.load);
  useEffect(() => { loadConfig(); }, [loadConfig]);
  // Poll positions and alerts so follow-ups appear without a reload.
  useEffect(() => {
    loadPositions();
    const t = setInterval(loadPositions, 20000);
    return () => clearInterval(t);
  }, [loadPositions]);
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBars />
        <main className="flex-1 px-4 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">{children}</main>
      </div>
      <StockDrawer />
      <AlertToasts />
    </div>
  );
}

/** Sticky page header: title, market status, theme switch. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <header className="-mx-4 mb-3 flex flex-wrap items-center justify-between gap-3 border-b bg-background/85 px-4 pb-2.5 backdrop-blur lg:sticky lg:top-0 lg:z-20 lg:-mx-6 lg:-mt-5 lg:px-6 lg:pt-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="hidden text-[13px] text-muted-foreground sm:block">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <MarketStatusBadge className="hidden lg:inline-flex" />
        <AlertsBell className="hidden lg:grid" />
        <ThemeToggle className="hidden lg:grid" />
      </div>
    </header>
  );
}
