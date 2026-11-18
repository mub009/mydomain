"use client";

import { create } from "zustand";
import { UNIVERSES, type Universe } from "@/lib/market/universe";
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

interface Settings {
  universe: Universe;
  custom: string;
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

  set: (patch: Partial<Settings>) => void;
  loadConfig: () => Promise<void>;
  replaySession: () => Promise<void>;
  run: () => Promise<void>;
  skip: () => void;
  markSeen: (thread: string) => void;
  openStock: (symbol: string | null) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let skipping = false;
let abort: AbortController | undefined;

export const symbolsOf = (s: Pick<Settings, "universe" | "custom">) =>
  s.universe !== "custom" ? UNIVERSES[s.universe].symbols
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
    universe: "large", custom: "RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, LT, ITC, MARUTI, TITAN",
    top: 5, capital: "500000", risk: 1, demo: false, aiNotes: false, speed: "normal",
    config: null, session: null, replayOf: null, running: false, progress: null, error: null,
    messages: [], shown: 0, typing: null, times: {}, result: null, seen: {}, drawerSymbol: null,

    set: (patch) => {
      set(patch);
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
            symbols: symbolsOf(s), top: s.top, demo: s.demo, aiNotes: s.aiNotes && Boolean(s.config?.aiAvailable),
            capital: Number(s.capital) > 0 ? Number(s.capital) : undefined, riskPerTrade: s.risk,
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

    openStock: (symbol) => set({ drawerSymbol: symbol }),
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
