import { isBigUniverse } from "@/lib/market/lists";
import { MIN_PROFIT_CHOICES, MIN_PROFIT_PCT } from "@/lib/agents/decision";
import { RESEARCH_CHOICES, SHORTLIST } from "@/lib/pipeline";
import { runAnalysis } from "@/lib/pipeline";
import type { RunRequest, StreamEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // a full live run can take a few minutes on a hosted server

const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;

/** Sample (demo) prices are only accepted where ALLOW_DEMO_DATA=true, e.g. for local testing. */
function validate(body: unknown): RunRequest | string {
  const b = body as Partial<RunRequest>;
  if (!b) return "symbols must be a list";
  const universe = isBigUniverse(b.universe) ? b.universe : undefined;
  if (!universe && !Array.isArray(b.symbols)) return "symbols must be a list";
  const symbols = universe ? [] : [...new Set((b.symbols ?? []).map((s) => String(s).trim().toUpperCase()))].filter(Boolean);
  if (!universe && (symbols.length < 3 || symbols.length > 150)) return "Choose between 3 and 150 stocks";
  const bad = symbols.find((s) => !SYMBOL.test(s));
  if (bad) return `"${bad.slice(0, 20)}" is not a valid NSE symbol`;
  const top = Number(b.top);
  if (![3, 5, 10, 15, 20, 25].includes(top)) return "top must be 3, 5, 10, 15, 20 or 25";
  const riskPerTrade = Number(b.riskPerTrade);
  if (![0.5, 1, 2, 3].includes(riskPerTrade)) return "risk must be 0.5, 1, 2 or 3";
  let capital: number | undefined;
  if (b.capital !== undefined && b.capital !== null) {
    capital = Number(b.capital);
    if (!Number.isFinite(capital) || capital < 0 || capital > 1e11) return "capital is out of range";
    if (capital === 0) capital = undefined;
  }
  // Sectors for searched stocks: only for symbols in this run, plain names only.
  const sectors: Record<string, string> = {};
  if (b.sectors && typeof b.sectors === "object") {
    for (const [k, v] of Object.entries(b.sectors)) {
      const sym = k.toUpperCase();
      if (symbols.includes(sym) && typeof v === "string" && /^[A-Za-z &]{2,30}$/.test(v)) sectors[sym] = v;
    }
  }
  const minProfitPct = b.minProfitPct === undefined ? MIN_PROFIT_PCT : Number(b.minProfitPct);
  if (!(MIN_PROFIT_CHOICES as readonly number[]).includes(minProfitPct)) return `minProfitPct must be one of ${MIN_PROFIT_CHOICES.join(", ")}`;
  const research = b.research === undefined ? SHORTLIST : Number(b.research);
  if (!(RESEARCH_CHOICES as readonly number[]).includes(research)) return `research must be one of ${RESEARCH_CHOICES.join(", ")}`;
  return { symbols, top, riskPerTrade, capital, minProfitPct, research, demo: Boolean(b.demo) && process.env.ALLOW_DEMO_DATA === "true", aiNotes: Boolean(b.aiNotes), sectors, ...(universe ? { universe } : {}) };
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
