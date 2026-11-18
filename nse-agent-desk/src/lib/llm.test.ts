import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAvailable, aiModel, LLM } from "./llm";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("AI notes provider", () => {
  it("is off without a key", () => {
    vi.stubEnv("NVIDIA_API_KEY", ""); vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(aiAvailable()).toBe(false);
  });

  it("calls NVIDIA's OpenAI-compatible endpoint with the key", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-test"); vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("AI_PROVIDER", "");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: " RELIANCE looks strong. " } }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect(aiModel()).toBe("meta/llama-3.3-70b-instruct");
    const out = await new LLM(true).comment("Momentum", "Explain", { a: 1 });
    expect(out).toBe("RELIANCE looks strong.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer nvapi-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("meta/llama-3.3-70b-instruct");
    expect(body.messages[0].role).toBe("system");
  });

  it("fails soft: a bad response gives no note instead of an error", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await new LLM(true).comment("Trend", "Explain", {})).toBeUndefined();
  });

  it("AI_PROVIDER chooses when both keys are set", () => {
    vi.stubEnv("NVIDIA_API_KEY", "n"); vi.stubEnv("ANTHROPIC_API_KEY", "a"); vi.stubEnv("AI_PROVIDER", "anthropic");
    expect(aiModel()).toMatch(/^claude/);
  });
});
