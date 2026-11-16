import type { AgentName, Message } from "./types";

/** Message bus the four agents use to talk. Every message is kept and
 *  pushed to the UI as it is sent, so the conversation appears live. */
export class MessageBus {
  log: Message[] = [];
  private payloads = new Map<number, unknown>();

  constructor(private onMessage?: (m: Message) => void) {}

  send<T>(sender: AgentName, to: Message["to"], subject: string, text: string,
    payload?: T, aiNote?: string): Message {
    const msg: Message = {
      id: this.log.length + 1, sender, to, subject, text, aiNote,
      time: new Date().toLocaleTimeString(),
    };
    this.log.push(msg);
    this.payloads.set(msg.id, payload);
    this.onMessage?.(msg);
    return msg;
  }

  /** Latest payload `sender` sent to `to`. */
  latest<T>(to: AgentName, sender: AgentName): T {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const m = this.log[i];
      if (m.sender === sender && (m.to === to || m.to === "ALL")) return this.payloads.get(m.id) as T;
    }
    throw new Error(`${to} has no message from ${sender}`);
  }
}
