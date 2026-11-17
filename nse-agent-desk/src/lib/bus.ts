import { isDeskAgent } from "./team";
import type { AgentName, Message, Stage } from "./types";

/** One-to-one threads, except the research desk (Research Agent and its three sub-agents), which shares one. */
export const threadOf = (a: AgentName, b: AgentName | "ALL") =>
  b === "ALL" ? "team" : isDeskAgent(a) || isDeskAgent(b) ? "desk" : [a, b].sort().join("|");

/** Message bus the four agents talk through. Each message is emitted as soon
 *  as it is sent (streamed to the browser over Server-Sent Events). */
export class MessageBus {
  log: Message[] = [];
  stage: Stage = "scan";

  constructor(private onMessage?: (m: Message) => void) {}

  send(sender: AgentName, to: Message["to"], text: string,
    opts: Partial<Pick<Message, "kind" | "tickers" | "table" | "aiNote">> = {}): Message {
    const msg: Message = {
      id: this.log.length + 1, sender, to, thread: threadOf(sender, to), stage: this.stage,
      kind: opts.kind ?? "chat", text, tickers: opts.tickers ?? [], table: opts.table, aiNote: opts.aiNote,
    };
    this.log.push(msg);
    this.onMessage?.(msg);
    return msg;
  }
}
