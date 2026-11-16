"""Optional Claude commentary for each agent.

If ANTHROPIC_API_KEY is set (and --no-llm is not passed), each agent asks
Claude to explain its findings in plain language. The scores and the final
picks always come from the rule-based logic, so results are reproducible
with or without the LLM.
"""
from __future__ import annotations

import json
import os

DEFAULT_MODEL = os.getenv("STOCK_AGENT_MODEL", "claude-opus-5-5")


class LLM:
    def __init__(self, enabled: bool = True, model: str = DEFAULT_MODEL):
        self.client = None
        self.model = model
        if enabled and os.getenv("ANTHROPIC_API_KEY"):
            try:
                import anthropic

                self.client = anthropic.Anthropic()
            except ImportError:
                print("  ! `anthropic` not installed - running without LLM commentary.")

    @property
    def active(self) -> bool:
        return self.client is not None

    def comment(self, persona: str, task: str, data) -> str | None:
        if not self.client:
            return None
        try:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=700,
                system=(
                    f"You are {persona}, one member of a four-agent stock research team "
                    "for the Indian market (NSE). Be concise, concrete and use the numbers "
                    "given. Never invent data. This is research, not financial advice."
                ),
                messages=[{
                    "role": "user",
                    "content": f"{task}\n\nData (JSON):\n{json.dumps(data, default=str, indent=1)}",
                }],
            )
            return "".join(b.text for b in resp.content if b.type == "text").strip()
        except Exception as exc:
            print(f"  ! LLM call failed ({exc}); continuing with rule-based output.")
            return None
