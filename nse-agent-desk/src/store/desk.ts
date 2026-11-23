"use client";

import { create } from "zustand";
import { UNIVERSES, type Universe } from "@/lib/market/universe";
import { type BigUniverse, isBigUniverse } from "@/lib/market/lists";
import { PEOPLE } from "@/lib/team";
import type { AgentName, Decision, Message, Person, RunResult, Stage, StreamEvent } from "@/lib/types";

export type Speed = "slow" | "normal" | "fast";
const SPEED: Record<Speed, number> = { slow: 0.55, normal: 1, fast: 2.6 };
export type Presence = "Idle" | "Online" | "Typing" | "Analyzing" | "Reviewing";

export interface SessionInfo {
  enabled: boolean;
  time: string;
  /** When the latest 9 AM run happened, if any. */
  ranAt: string | null;
}

export interface ServerConfig {
  aiAvailable: boolean;
  aiModel: string;
  provider: { id: string; label: string; realtime: boolean } | null;
}

export interface StockInfo { name: string; sector?: string }
export interface StockGroup { name: string; symbols: string[] }

interface Settings {
  /** A starter list, My Stocks, or a big list (Nifty 500, all NSE) that the server quick-scans. */
  universe: Universe | BigUniverse;
  custom: string;
  /** Names and sectors of stocks picked with the search. */
  stockInfo: Record<string, StockInfo>;
  /** Saved groups of stocks. */
  groups: StockGroup[];
  top: number;
  capital: string;
  risk: number;
  demo: boolean;
  aiNotes: boolean;
  speed: Speed;
}

interface DeskState extends Settings {
  config: ServerConfig | null;
  session: SessionInfo | null;
  /** Set while showing a saved News Agent run instead of a live one. */
  replayOf: string | null;
  running: boolean; // server is still working
  progress: string | null;
  error: string | null;
  messages: Message[];
  shown: number; // how many messages have been revealed
  typing: AgentName | null;
  times: Record<number, number>; // message id -> reveal time (ms)
  result: RunResult | null;
  seen: Record<string, number>;
  drawerSymbol: string | null;
  /** Single-stock searches: each stock's own small run, by symbol. */
  lookups: Record<string, RunResult>;
  lookup: { symbol: string; name?: string; loading: boolean; error?: string } | null;

  set: (patch: Partial<Settings>) => void;
  loadConfig: () => Promise<void>;
  replaySession: () => Promise<void>;
  run: () => Promise<void>;
  skip: () => void;
  markSeen: (thread: string) => void;
  openStock: (symbol: string | null) => void;
  /** Open any NSE stock: from the current run if it's there, otherwise analyse it on its own. */
  searchStock: (symbol: string, info?: { name?: string; sector?: string }) => Promise<void>;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let skipping = false;
let abort: AbortController | undefined;

const SAVED = "nse-desk:my-stocks";
/** My List, its stock names and the saved groups live in this browser. */
function saveLocal(s: Pick<Settings, "custom" | "stockInfo" | "groups">) {
  try { localStorage.setItem(SAVED, JSON.stringify({ custom: s.custom, stockInfo: s.stockInfo, groups: s.groups })); } catch { /* storage unavailable */ }
}
function loadLocal(): Partial<Settings> {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED) ?? "null");
    if (!v || typeof v.custom !== "string") return {};
    return { custom: v.custom, stockInfo: v.stockInfo ?? {}, groups: Array.isArray(v.groups) ? v.groups : [] };
  } catch { return {}; }
}

export const symbolsOf = (s: Pick<Settings, "universe" | "custom">): string[] =>
  isBigUniverse(s.universe) ? [] // the server downloads the list
  : s.universe !== "custom" ? UNIVERSES[s.universe].symbols
    : [...new Set(s.custom.split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];

export const useDesk = create<DeskState>((set, get) => {
  /** Reveal queued messages one at a time, with a typing pause sized to the message. */
  function play() {
    clearTimeout(timer);
    const s = get();
    if (s.shown >= s.messages.length) { set({ typing: null }); return; }
    const next = s.messages[s.shown];
    const instant = skipping || next.kind === "system";
    const delay = instant ? 0
      : Math.min(3600, 850 + next.text.length * 13 + (next.table?.rows.length ?? 0) * 170) / SPEED[s.speed];
    set({ typing: instant ? null : next.sender });
    timer = setTimeout(() => {
      set((st) => ({ shown: st.shown + 1, times: { ...st.times, [next.id]: Date.now() } }));
      play();
    }, delay);
  }

  return {
    universe: "large", custom: "RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, LT, ITC, MARUTI, TITAN", stockInfo: {}, groups: [],
    top: 5, capital: "500000", risk: 1, demo: false, aiNotes: false, speed: "normal",
    config: null, session: null, replayOf: null, running: false, progress: null, error: null,
    messages: [], shown: 0, typing: null, times: {}, result: null, seen: {}, drawerSymbol: null, lookups: {}, lookup: null,

    set: (patch) => {
      set(patch);
      if ("custom" in patch || "stockInfo" in patch || "groups" in patch) saveLocal(get());
      if (patch.speed && get().shown < get().messages.length) play(); // re-time the pending message
    },

    replaySession: async () => {
      abort?.abort();
      clearTimeout(timer);
      skipping = false;
      try {
        const res = await (await fetch("/api/session")).json();
        if (!res.session) { set({ error: "No News Agent has run yet." }); return; }
        set({
          running: false, progress: null, error: null, messages: res.session.messages, shown: 0, typing: null, times: {},
          result: res.session.result, seen: {}, drawerSymbol: null, replayOf: res.session.ranAt,
        });
        play();
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    loadConfig: async () => {
      set(loadLocal()); // My List and saved groups from this browser
      fetch("/api/session").then((r) => r.json())
        .then((r) => set({ session: { enabled: r.enabled, time: r.time, ranAt: r.session?.ranAt ?? null } }))
        .catch(() => { /* optional */ });
      try { set({ config: await (await fetch("/api/config")).json() }); } catch { /* keep defaults */ }
    },

    run: async () => {
      abort?.abort();
      clearTimeout(timer);
      skipping = false;
      const s = get();
      set({ replayOf: null, running: true, progress: "Starting…", error: null, messages: [], shown: 0, typing: null, times: {}, result: null, seen: {}, drawerSymbol: null });
      abort = new AbortController();
      try {
        const res = await fetch("/api/analysis", {
          method: "POST", signal: abort.signal, headers: { "content-type": "application/json" },
          body: JSON.stringify({
            symbols: symbolsOf(s), ...(isBigUniverse(s.universe) ? { universe: s.universe } : {}), top: s.top, demo: s.demo, aiNotes: s.aiNotes && Boolean(s.config?.aiAvailable),
            capital: Number(s.capital) > 0 ? Number(s.capital) : undefined, riskPerTrade: s.risk,
            sectors: s.universe === "custom" ? Object.fromEntries(symbolsOf(s).flatMap((k) => (s.stockInfo[k]?.sector ? [[k, s.stockInfo[k].sector]] : []))) : undefined,
          }),
        });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Server error ${res.status}`);

        // Parse the Server-Sent Events stream.
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const line = buf.slice(0, i).replace(/^data: /, "");
            buf = buf.slice(i + 2);
            if (!line) continue;
            const e = JSON.parse(line) as StreamEvent;
            if (e.type === "progress") set({ progress: e.text });
            else if (e.type === "result") set({ result: e.result });
            else if (e.type === "error") set({ error: e.message });
            else {
              const idle = get().shown >= get().messages.length;
              set((st) => ({ messages: [...st.messages, e.message] }));
              if (idle) play();
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") set({ error: (e as Error).message });
      } finally {
        set({ running: false, progress: null });
      }
    },

    skip: () => {
      skipping = true;
      clearTimeout(timer);
      const now = Date.now();
      set((st) => {
        const times = { ...st.times };
        for (const m of st.messages) times[m.id] ??= now;
        return { shown: st.messages.length, typing: null, times };
      });
    },

    markSeen: (thread) => {
      const s = get();
      const count = s.messages.slice(0, s.shown).filter((m) => thread === "all" || m.thread === thread).length;
      if (s.seen[thread] !== count) set({ seen: { ...s.seen, [thread]: count } });
    },

    openStock: (symbol) => set({ drawerSymbol: symbol, ...(symbol ? {} : { lookup: null }) }),

    searchStock: async (symbol, info) => {
      const s = get();
      // In the current run with the full research (research desk)? Open it straight away. Otherwise
      // show what the run has (if anything) while the full research loads.
      if (s.result?.all.some((d) => d.symbol === symbol && d.desk) && s.shown >= s.messages.length) { set({ drawerSymbol: symbol, lookup: null }); return; }
      if (s.lookups[symbol]) { set({ drawerSymbol: symbol, lookup: null }); return; }
      set({ drawerSymbol: symbol, lookup: { symbol, name: info?.name, loading: true } });
      try {
        const res = await fetch("/api/stock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbol, sector: info?.sector }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.result) throw new Error(j.error ?? `Server error ${res.status}`);
        if (get().drawerSymbol !== symbol) return; // closed or switched meanwhile
        set((st) => ({ lookups: { ...st.lookups, [symbol]: j.result }, lookup: null }));
      } catch (e) {
        if (get().drawerSymbol === symbol) set({ lookup: { symbol, name: info?.name, loading: false, error: (e as Error).message } });
      }
    },
  };
});

// ---------- derived state ----------

/** True while the server is working or messages are still being revealed. */
export const useBusy = () => useDesk((s) => s.running || s.shown < s.messages.length);

/** The picks are revealed only after Decision Agent's announcement has appeared in the chat. */
export function useDecided(): RunResult | null {
  return useDesk((s) => {
    if (!s.result) return null;
    const i = s.messages.findIndex((m) => m.kind === "decision");
    return i >= 0 && s.shown > i ? s.result : null;
  });
}

/** Research progress: which step the team is on. */
export function useStage(): { stage: Stage | null; done: boolean } {
  const stage = useDesk((s) => {
    if (!s.running && !s.messages.length) return null;
    const m = s.messages[Math.min(s.shown, s.messages.length - 1)];
    return m?.stage ?? "scan";
  });
  const done = useDesk((s) => s.messages.length > 0 && !s.running && s.shown >= s.messages.length);
  return { stage, done };
}

export function usePresence(): Record<Person, Presence> {
  const typing = useDesk((s) => s.typing);
  const active = useDesk((s) => s.running || s.messages.length > 0);
  const loading = useDesk((s) => s.running && s.messages.length === 0);
  const { stage, done } = useStage();
  const out = {} as Record<Person, Presence>;
  for (const p of PEOPLE) {
    let v: Presence = "Idle";
    if (active) {
      v = "Online";
      if (loading) v = p === "Decision" || p === "Research" ? "Idle" : "Analyzing";
      else if (!done) {
        if (stage === "scan" && p === "Decision") v = "Idle";
        if (stage === "scan" && p === "Research") v = "Reviewing";
        if (stage === "analyze" && p === "Research") v = "Analyzing";
        if (stage === "analyze" && p === "Decision") v = "Idle";
        if (stage === "debate" && p === "Decision") v = "Reviewing";
      }
      if (typing === p) v = "Typing";
    }
    out[p] = v;
  }
  return out;
}

export const findStock = (r: RunResult | null, symbol: string | null): Decision | undefined =>
  r && symbol ? r.all.find((d) => d.symbol === symbol) : undefined;

/** The run that holds the open stock: its own single-stock run when it was searched, else the current run. */
export function useStockResult(): RunResult | null {
  // A stock looked up on its own has the full research, so it wins over a lighter entry in the current run.
  return useDesk((s) => (s.drawerSymbol && s.lookups[s.drawerSymbol] ? s.lookups[s.drawerSymbol] : s.result));
}
