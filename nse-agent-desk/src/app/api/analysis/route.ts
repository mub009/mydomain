import { runAnalysis } from "@/lib/pipeline";
import type { RunRequest, StreamEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;

function validate(body: unknown): RunRequest | string {
  const b = body as Partial<RunRequest>;
  if (!b || !Array.isArray(b.symbols)) return "symbols must be a list";
  const symbols = [...new Set(b.symbols.map((s) => String(s).trim().toUpperCase()))].filter(Boolean);
  if (symbols.length < 3 || symbols.length > 60) return "Choose between 3 and 60 stocks";
  const bad = symbols.find((s) => !SYMBOL.test(s));
  if (bad) return `"${bad.slice(0, 20)}" is not a valid NSE symbol`;
  const top = Number(b.top);
  if (![3, 5, 10, 15].includes(top)) return "top must be 3, 5, 10 or 15";
  const riskPerTrade = Number(b.riskPerTrade);
  if (![0.5, 1, 2, 3].includes(riskPerTrade)) return "risk must be 0.5, 1, 2 or 3";
  let capital: number | undefined;
  if (b.capital !== undefined && b.capital !== null) {
    capital = Number(b.capital);
    if (!Number.isFinite(capital) || capital < 0 || capital > 1e11) return "capital is out of range";
    if (capital === 0) capital = undefined;
  }
  return { symbols, top, riskPerTrade, capital, demo: Boolean(b.demo), aiNotes: Boolean(b.aiNotes) };
}

/** Runs one analysis and streams progress, agent messages and the result as Server-Sent Events. */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const opts = validate(body);
  if (typeof opts === "string") return Response.json({ error: opts }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: StreamEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await runAnalysis(opts, emit);
      } catch (e) {
        console.error("[nse-agent-desk] run failed:", e);
        emit({ type: "error", message: (e as Error).message || "Analysis failed" });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
