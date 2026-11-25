/**
 * Pass-through to the NSE Desk API (Laravel) from this site's own address.
 * The browser then never makes a cross-site request (no CORS pre-check), and
 * the API host's bot check, which sometimes answers instead of the API, is
 * retried here on the server.
 */
import { safePath } from "@/lib/desk-path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BASE = (process.env.DESK_API_URL ?? process.env.NEXT_PUBLIC_DESK_API ?? "").replace(/\/$/, "");


async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!BASE) return Response.json({ message: "The NSE Desk API is not set up on this site." }, { status: 503 });
  if (!safePath(path)) return Response.json({ message: "Not found" }, { status: 404 });
  const sub = path.map(encodeURIComponent).join("/");
  const url = `${BASE}/api/${sub}${new URL(req.url).search}`;
  const headers: Record<string, string> = { accept: "application/json", "user-agent": "NSE-Agent-Desk/1.0 (+https://nse-agent-desk.vercel.app)" };
  for (const h of ["authorization", "content-type"]) { const v = req.headers.get(h); if (v) headers[h] = v; }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  let last: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 600 * attempt));
    try {
      const res = await fetch(url, { method: req.method, headers, body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000) });
      const type = res.headers.get("content-type") ?? "";
      // The host's bot check answers with HTML; the API always answers with JSON (or 204).
      if (type.includes("json") || res.status === 204) {
        return new Response(res.status === 204 ? null : await res.text(), { status: res.status, headers: { "content-type": type || "application/json", "cache-control": "no-store" } });
      }
      last = res;
    } catch { /* network hiccup: try again */ }
  }
  console.warn(`[nse-agent-desk] desk API unreachable (${last ? `HTTP ${last.status}, ${last.headers.get("content-type")}` : "network error"}): ${sub}`);
  return Response.json({ message: "Can't reach the login server right now. Please try again in a moment." }, { status: 502 });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
