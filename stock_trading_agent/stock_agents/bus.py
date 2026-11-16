"""A tiny message bus so the four agents can talk to each other.

Every message is stored, so the full conversation can be printed or saved
as part of the report.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Message:
    sender: str
    to: str
    subject: str
    text: str
    payload: Any = None


@dataclass
class MessageBus:
    log: list[Message] = field(default_factory=list)
    verbose: bool = True

    def send(self, sender: str, to: str, subject: str, text: str, payload: Any = None) -> Message:
        msg = Message(sender, to, subject, text, payload)
        self.log.append(msg)
        if self.verbose:
            print(f"\n[{sender} -> {to}] {subject}\n  {text.replace(chr(10), chr(10) + '  ')}")
        return msg

    def inbox(self, name: str) -> list[Message]:
        return [m for m in self.log if m.to in (name, "ALL")]

    def latest(self, name: str, sender: str) -> Message | None:
        for m in reversed(self.log):
            if m.to in (name, "ALL") and m.sender == sender:
                return m
        return None

    def transcript(self) -> list[dict]:
        return [{k: v for k, v in asdict(m).items() if k != "payload"} for m in self.log]
