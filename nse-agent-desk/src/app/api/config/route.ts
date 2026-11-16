import { aiAvailable, aiModel } from "@/lib/llm";
import { getProvider } from "@/lib/market";

export const dynamic = "force-dynamic";

export function GET() {
  const p = getProvider();
  return Response.json({
    aiAvailable: aiAvailable(),
    aiModel: aiModel(),
    provider: p ? { id: p.id, label: p.label, realtime: p.realtime } : null,
  });
}
