/**
 * Optional real model calls for the agents' "AI notes". Server-side only: API
 * keys are read from the environment and never reach the browser. Scores and
 * picks never depend on this; it only adds explanations.
 *
 * Providers (AI_PROVIDER, or picked automatically from whichever key is set):
 *   nvidia    - NVIDIA API catalog (build.nvidia.com), OpenAI-compatible.
 *               NVIDIA_API_KEY, NVIDIA_MODEL (default meta/llama-3.3-70b-instruct)
 *   anthropic - Claude. ANTHROPIC_API_KEY, STOCK_AGENT_MODEL (default claude-opus-5-5)
 */
type Provider = "nvidia" | "anthropic";

function provider(): Provider | null {
  const want = process.env.AI_PROVIDER?.toLowerCase();
  if (want === "nvidia") return process.env.NVIDIA_API_KEY ? "nvidia" : null;
  if (want === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export const aiAvailable = () => provider() !== null;
export const aiModel = () =>
  provider() === "nvidia"
    ? process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct"
    : process.env.STOCK_AGENT_MODEL || "claude-opus-5-5";

const NVIDIA_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

export class LLM {
  enabled: boolean;
  constructor(requested: boolean) {
    this.enabled = requested && aiAvailable();
  }

  async comment(persona: string, task: string, data: unknown): Promise<string | undefined> {
    if (!this.enabled) return undefined;
    const system =
      `You are ${persona}, one member of an AI stock research team for the Indian ` +
      "market (NSE). Be concise, concrete and use only the numbers given. Never invent data. " +
      "This is research, not financial advice.";
    const user = `${task}\n\nData (JSON):\n${JSON.stringify(data, null, 1)}`;
    try {
      if (provider() === "nvidia") {
        const res = await fetch(`${NVIDIA_URL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
          body: JSON.stringify({
            model: aiModel(), max_tokens: 600, temperature: 0.3,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error(`NVIDIA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const json = await res.json();
        return String(json.choices?.[0]?.message?.content ?? "").trim() || undefined;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: aiModel(), max_tokens: 600, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const json = await res.json();
      return (json.content as { type: string; text?: string }[])
        .filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    } catch (e) {
      console.warn("[nse-agent-desk] AI note failed:", (e as Error).message);
      return undefined;
    }
  }
}
