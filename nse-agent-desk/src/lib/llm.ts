/**
 * Optional real model calls for the agents' "AI notes". Server-side only: the
 * API key is read from the environment and never reaches the browser.
 * Scores and picks never depend on this; it only adds explanations.
 */
export const aiModel = () => process.env.STOCK_AGENT_MODEL || "claude-opus-5-5";
export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class LLM {
  enabled: boolean;
  constructor(requested: boolean) {
    this.enabled = requested && aiAvailable();
  }

  async comment(persona: string, task: string, data: unknown): Promise<string | undefined> {
    if (!this.enabled) return undefined;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: aiModel(),
          max_tokens: 600,
          system:
            `You are ${persona}, one member of a four-agent stock research team for the Indian ` +
            "market (NSE). Be concise, concrete and use only the numbers given. Never invent data. " +
            "This is research, not financial advice.",
          messages: [{ role: "user", content: `${task}\n\nData (JSON):\n${JSON.stringify(data, null, 1)}` }],
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.content as { type: string; text?: string }[])
        .filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    } catch (e) {
      console.warn("[nse-agent-desk] AI note failed:", (e as Error).message);
      return undefined;
    }
  }
}
