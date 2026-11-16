import type { AgentName, Message } from "./types";

export const threadOf = (a: AgentName, b: AgentName | "ALL") =>
  b === "ALL" ? "team" : [a, b].sort().join("|");

/** Message bus the four agents talk through. Each message is pushed to the
 *  UI as soon as it is sent; the UI then plays them back with typing delays. */
export class MessageBus {
  log: Message[] = [];

  constructor(private onMessage?: (m: Message) => void) {}

  send(sender: AgentName, to: Message["to"], text: string,
    opts: Partial<Pick<Message, "kind" | "tickers" | "rows" | "aiNote">> = {}): Message {
    const msg: Message = {
      id: this.log.length + 1, sender, to, thread: threadOf(sender, to),
      kind: opts.kind ?? "chat", text, tickers: opts.tickers ?? [], rows: opts.rows, aiNote: opts.aiNote,
    };
    this.log.push(msg);
    this.onMessage?.(msg);
    return msg;
  }
}
