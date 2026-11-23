import { change } from "@/lib/positions/store";

export const dynamic = "force-dynamic";

/** Mark alerts as read: { ids: [...] } or { all: true }. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const ids = new Set<string>(Array.isArray(b.ids) ? b.ids : []);
  const { state } = await change(b.state, (s) => { for (const a of s.alerts) if (b.all || ids.has(a.id)) a.read = true; });
  return state ? Response.json({ state }) : new Response(null, { status: 204 });
}
