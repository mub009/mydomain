from __future__ import annotations

from ..bus import MessageBus
from ..llm import LLM


class Agent:
    name = "Agent"
    role = ""

    def __init__(self, bus: MessageBus, llm: LLM):
        self.bus = bus
        self.llm = llm

    def say(self, to: str, subject: str, text: str, payload=None):
        return self.bus.send(self.name, to, subject, text, payload)

    def explain(self, task: str, data) -> str | None:
        return self.llm.comment(f"{self.name}, the {self.role}", task, data)


def clamp(x: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, x))


def short_list(reports: list[dict], n: int = 5) -> str:
    return "\n".join(
        f"{i}. {r['symbol']:<12} score {r['score']:5.1f}  {r['signal']:<6} {'; '.join(r['reasons'][:2])}"
        for i, r in enumerate(reports[:n], 1)
    )
