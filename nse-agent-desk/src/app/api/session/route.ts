import { getLatestSession, runMorningSession, sessionTime } from "@/lib/session/scheduler";

export const dynamic = "force-dynamic";

/** The latest News Agent run, for the app to replay. */
export async function GET() {
  const s = await getLatestSession();
  return Response.json({
    enabled: process.env.MORNING_SESSION_ENABLED === "true",
    time: sessionTime(),
    session: s,
  });
}

/**
 * Run the News Agent now (for an external cron on serverless hosts, or a
 * manual re-run). Requires the header `Authorization: Bearer <SESSION_TRIGGER_TOKEN>`.
 */
export async function POST(req: Request) {
  const token = process.env.SESSION_TRIGGER_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "Not allowed. Set SESSION_TRIGGER_TOKEN and send it as a Bearer token." }, { status: 403 });
  }
  try {
    const s = await runMorningSession("manual");
    return Response.json({ ok: true, ranAt: s.ranAt, picks: s.result.picks.map((p) => p.symbol) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
