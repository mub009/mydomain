"use client";

import { create } from "zustand";
import type { Position, PositionAlert } from "@/lib/positions/types";

export interface Toast { id: string; alert: PositionAlert }

interface PositionsStore {
  positions: Position[];
  alerts: PositionAlert[];
  lastRunAt: string | null;
  monitor: { enabled: boolean; minutes: number; telegram: boolean } | null;
  toasts: Toast[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (p: { symbol: string; qty: number; buyPrice: number; stop: number; target: number; feed: "demo" | "live" }) => Promise<string | null>;
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
      const r = await (await fetch("/api/positions", { cache: "no-store" })).json();
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
    const res = await fetch("/api/positions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? `Error ${res.status}`;
    await get().load();
    return null;
  },

  close: async (id, exitPrice) => {
    await fetch(`/api/positions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "close", exitPrice }) });
    await get().load();
  },

  remove: async (id) => {
    await fetch(`/api/positions/${id}`, { method: "DELETE" });
    await get().load();
  },

  checkNow: async () => {
    await fetch("/api/positions/check", { method: "POST" });
    await get().load();
  },

  markAllRead: async () => {
    await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) });
    set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })), toasts: [] }));
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const useUnreadAlerts = () => usePositions((s) => s.alerts.filter((a) => !a.read).length);
