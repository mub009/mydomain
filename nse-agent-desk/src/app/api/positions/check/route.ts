import { checkPositions } from "@/lib/positions/monitor";

export const dynamic = "force-dynamic";

/** Check all open positions now ("Check now" button). */
export async function POST() {
  const alerts = await checkPositions("all");
  return Response.json({ alerts });
}
