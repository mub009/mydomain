/**
 * Optional Claude commentary. Requests go to /claude (Vite proxy), which adds
 * the API key from .env on the server side. Scores and picks never depend on
 * this, it only adds plain-language explanations.
 */
declare const __AI_ENABLED__: boolean;
declare const __AI_MODEL__: string;

export const aiAvailable = typeof __AI_ENABLED__ !== "undefined" && __AI_ENABLED__;
export const aiModel = typeof __AI_MODEL__ !== "undefined" ? __AI_MODEL__ : "claude-opus-5-5";

export class LLM {
  constructor(public enabled: boolean) {}

  async comment(persona: string, task: string, data: unknown): Promise<string | undefined> {
    if (!this.enabled) return undefined;
    try {
      const res = await fetch("/claude/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: aiModel,
          max_tokens: 700,
          system:
            `You are ${persona}, one member of a four-agent stock research team for the Indian ` +
            "market (NSE). Be concise, concrete and use the numbers given. Never invent data. " +
            "This is research, not financial advice.",
          messages: [{ role: "user", content: `${task}\n\nData (JSON):\n${JSON.stringify(data, null, 1)}` }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.content as { type: string; text?: string }[])
        .filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    } catch (e) {
      console.warn("Claude commentary failed:", e);
      return undefined;
    }
  }
}
