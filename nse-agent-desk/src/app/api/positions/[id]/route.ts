import { update } from "@/lib/positions/store";

export const dynamic = "force-dynamic";

/** Close a position (record the exit price) or change its stop-loss / target. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const res = await update((s) => {
    const p = s.positions.find((x) => x.id === id);
    if (!p) return { error: "Not found", status: 404 };
    if (b.action === "close") {
      const exit = Number(b.exitPrice ?? p.lastPrice ?? p.buyPrice);
      if (!(exit > 0)) return { error: "Exit price must be above 0", status: 400 };
      p.status = "closed"; p.exitPrice = exit; p.closedAt = new Date().toISOString();
    } else {
      const stop = b.stop !== undefined ? Number(b.stop) : p.stop, target = b.target !== undefined ? Number(b.target) : p.target;
      if (!(stop > 0 && stop < target)) return { error: "Stop-loss must be above 0 and below the target", status: 400 };
      p.stop = stop; p.target = target;
    }
    return { position: p, status: 200 };
  });
  return Response.json(res, { status: res.status });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await update((s) => {
    s.positions = s.positions.filter((p) => p.id !== id);
    s.alerts = s.alerts.filter((a) => a.positionId !== id);
  });
  return new Response(null, { status: 204 });
}
