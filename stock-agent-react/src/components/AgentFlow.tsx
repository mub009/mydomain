import { AGENTS } from "../agentsInfo";
import type { AgentName } from "../lib/types";

export type Stage = AgentName | "Data" | "Done" | "Idle";
const ORDER: Stage[] = ["Data", "Lotappi", "Mayavi", "Mubashir", "FinalDecision", "Done"];

export function AgentFlow({ stage, detail }: { stage: Stage; detail?: string }) {
  const pos = ORDER.indexOf(stage);
  const status = (id: Stage) => {
    if (stage === "Idle") return "waiting";
    const i = ORDER.indexOf(id);
    return i < pos ? "done" : i === pos ? "working" : "waiting";
  };
  return (
    <section className="flow" aria-label="Agent pipeline">
      {AGENTS.map((a) => {
        const st = status(a.id);
        return (
          <div key={a.id} className={`agent-card agent-${a.id} ${st}`}>
            <div className="avatar">{a.initials}</div>
            <div>
              <div className="agent-name">{a.name}</div>
              <div className="agent-job">{a.job}</div>
              <div className="agent-status">
                {st === "working" ? <><span className="dot" /> working…</> : st === "done" ? "✓ done" : "waiting"}
              </div>
            </div>
          </div>
        );
      })}
      {stage === "Data" && detail && <div className="flow-detail">{detail}</div>}
    </section>
  );
}
