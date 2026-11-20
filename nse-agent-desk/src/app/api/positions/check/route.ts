import { checkPositions } from "@/lib/positions/monitor";

export const dynamic = "force-dynamic";

/** Check all open positions now ("Check now" button). Body { state } when the browser keeps the positions. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const r = await checkPositions("all", b?.state);
  return Response.json(r);
}
