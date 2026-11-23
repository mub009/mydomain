"use client";

import { create } from "zustand";
import { marketStatus } from "@/lib/market/calendar";
import type { Position, PositionAlert, PositionsState } from "@/lib/positions/types";

export type NewPosition = { symbol: string; qty: number; buyPrice: number; stop: number; target: number; feed: "demo" | "live"; sector?: string; cap?: string };

/* Hosted without a lasting disk (Vercel), positions live in this browser: they are
   sent with each request, and the server sends the changed copy back. */
const KEY = "nse-desk-positions-v1";
let storage: "server" | "browser" | null = null;
let lastDemoCheck = 0, lastLiveCheck = 0;
const readLocal = (): PositionsState => {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? ""); if (Array.isArray(s?.positions) && Array.isArray(s?.alerts)) return s; } catch { /* empty or blocked */ }
  return { positions: [], alerts: [] };
};
const writeLocal = (s: PositionsState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ } };

/** Send a request; in browser mode attach this browser's positions and keep the copy that comes back. */
async function send(url: string, method: string, body: Record<string, unknown> = {}): Promise<Response> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(storage === "browser" ? { ...body, state: readLocal() } : body) });
  if (storage === "browser" && res.ok && res.status !== 204) {
    const j = await res.clone().json().catch(() => null);
    if (j?.state) writeLocal(j.state);
  }
  return res;
}

export interface Toast { id: string; alert: PositionAlert }

interface PositionsStore {
  positions: Position[];
  alerts: PositionAlert[];
  lastRunAt: string | null;
  monitor: { enabled: boolean; minutes: number; telegram: boolean; inApp?: boolean } | null;
  toasts: Toast[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (p: NewPosition) => Promise<string | null>;
  /** Track several trades at once; returns the errors by symbol. */
  addMany: (ps: NewPosition[]) => Promise<Record<string, string>>;
  close: (id: string, exitPrice?: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  checkNow: () => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissToast: (id: string) => void;
}

const seen = new Set<string>();

function notify(a: PositionAlert) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification(a.title, { body: a.text, tag: a.id });
    }
  } catch { /* notifications are optional */ }
}

export const usePositions = create<PositionsStore>((set, get) => ({
  positions: [], alerts: [], lastRunAt: null, monitor: null, toasts: [], loaded: false, error: null,

  load: async () => {
    try {
      let r = await (await fetch("/api/positions", { cache: "no-store" })).json();
      storage = r.storage === "browser" ? "browser" : "server";
      if (storage === "browser") {
        const l = readLocal();
        r = { ...r, positions: l.positions, alerts: l.alerts.slice(-100).reverse(), lastRunAt: l.lastRunAt ?? null };
        // Nothing runs on the server between visits, so the app checks while it's open.
        const open = l.positions.filter((p) => p.status === "open");
        const now = Date.now();
        const demoDue = open.some((p) => p.feed === "demo") && now - lastDemoCheck > 60_000;
        const liveDue = open.some((p) => p.feed === "live") && marketStatus().open && now - lastLiveCheck > (r.monitor?.minutes ?? 5) * 60_000;
        if (get().loaded && (demoDue || liveDue)) {
          lastDemoCheck = now; if (liveDue) lastLiveCheck = now;
          await send("/api/positions/check", "POST");
          const c = readLocal();
          r = { ...r, positions: c.positions, alerts: c.alerts.slice(-100).reverse(), lastRunAt: c.lastRunAt ?? null };
        }
      }
      const first = !get().loaded;
      const fresh = (r.alerts as PositionAlert[]).filter((a) => !a.read && !seen.has(a.id));
      for (const a of r.alerts as PositionAlert[]) seen.add(a.id);
      set((s) => ({
        positions: r.positions, alerts: r.alerts, lastRunAt: r.lastRunAt, monitor: r.monitor, loaded: true, error: null,
        // On first load only remember what's there; afterwards new alerts pop up.
        toasts: first ? s.toasts : [...s.toasts, ...fresh.map((a) => ({ id: a.id, alert: a }))].slice(-4),
      }));
      if (!first) fresh.forEach(notify);
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  add: async (p) => {
    if (!storage) await get().load();
    const res = await send("/api/positions", "POST", p);
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? `Error ${res.status}`;
    await get().load();
    return null;
  },

  addMany: async (ps) => {
    if (!storage) await get().load();
    const errors: Record<string, string> = {};
    for (const p of ps) { // one at a time, so each change builds on the last
      const res = await send("/api/positions", "POST", p);
      if (!res.ok) errors[p.symbol] = (await res.json().catch(() => null))?.error ?? `Error ${res.status}`;
    }
    await get().load();
    return errors;
  },

  close: async (id, exitPrice) => {
    await send(`/api/positions/${id}`, "PATCH", { action: "close", exitPrice });
    await get().load();
  },

  remove: async (id) => {
    await send(`/api/positions/${id}`, "DELETE");
    await get().load();
  },

  checkNow: async () => {
    await send("/api/positions/check", "POST");
    await get().load();
  },

  markAllRead: async () => {
    await send("/api/alerts", "POST", { all: true });
    set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })), toasts: [] }));
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const useUnreadAlerts = () => usePositions((s) => s.alerts.filter((a) => !a.read).length);
