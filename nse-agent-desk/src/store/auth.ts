"use client";

/**
 * Login to the NSE Desk API (Laravel), when NEXT_PUBLIC_DESK_API is set.
 * The API token is kept in this browser; every API call sends it.
 */
import { create } from "zustand";

export const DESK_API = (process.env.NEXT_PUBLIC_DESK_API ?? "").replace(/\/$/, "");
const KEY = "nse-desk-auth-v1";

export interface DeskUser { id: number; name: string; email: string }

const read = (): { token: string; user: DeskUser } | null => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? ""); return v?.token ? v : null; } catch { return null; }
};
const write = (v: { token: string; user: DeskUser } | null) => {
  try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
};

/** A request to the API with this browser's token; a 401 logs you out. */
export async function deskApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuth.getState().token;
  // Through this site's own /api/desk pass-through (same address: no cross-site pre-check).
  const send = () => fetch(`/api/desk${path.replace(/^\/api/, "")}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  // The API's host sometimes answers with a security check page instead of the API
  // (the browser then reports a network error). It's random, so try again a few times.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4 && !res; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 700 * attempt));
    try {
      const r = await send();
      // A check page that did get through (HTML instead of JSON): treat it like a failed try.
      if (!(r.headers.get("content-type") ?? "").includes("json") && r.status !== 204 && attempt < 3) continue;
      res = r;
    } catch (e) { if (attempt === 3) throw e; }
  }
  if (!res || (!(res.headers.get("content-type") ?? "").includes("json") && res.status !== 204)) throw new Error("Failed to fetch");
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { write(null); useAuth.setState({ token: null, user: null }); }
  if (!res.ok) {
    const first = j?.errors ? Object.values(j.errors as Record<string, string[]>)[0]?.[0] : null;
    throw new Error(first ?? j?.message ?? `Error ${res.status}`);
  }
  return j as T;
}

interface AuthStore {
  ready: boolean; token: string | null; user: DeskUser | null;
  init: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirm: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  ready: false, token: null, user: null,
  init: () => { const v = read(); set({ ready: true, token: v?.token ?? null, user: v?.user ?? null }); },
  login: async (email, password) => {
    const r = await deskApi<{ token: string; user: DeskUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, device: "web" }) });
    write(r); set({ token: r.token, user: r.user });
  },
  register: async (name, email, password, confirm) => {
    const r = await deskApi<{ token: string; user: DeskUser }>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, password_confirmation: confirm, device: "web" }) });
    write(r); set({ token: r.token, user: r.user });
  },
  logout: async () => {
    await deskApi("/api/auth/logout", { method: "POST" }).catch(() => {});
    write(null); set({ token: null, user: null });
  },
}));
