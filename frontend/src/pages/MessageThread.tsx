import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ImageIcon, Send } from "lucide-react";
import { classifiedMessagesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedConversation, ClassifiedMessage } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/Loading";

export default function MessageThread() {
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);

  const [conversation, setConversation] = useState<ClassifiedConversation | null>(null);
  const [messages, setMessages] = useState<ClassifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    classifiedMessagesApi
      .thread(id, { pageSize: 200 })
      .then((r) => {
        setConversation(r.conversation);
        setMessages(r.data);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
    classifiedMessagesApi.markRead(id).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await classifiedMessagesApi.reply(id, body);
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Spinner label="Loading conversation…" />;
  if (error && !conversation) {
    return <div className="card p-8 text-center text-sm text-red-700">{error}</div>;
  }
  if (!conversation) return null;

  const photo = conversation.listing.photos?.[0]?.url;

  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ minHeight: "calc(100vh - 12rem)" }}>
      <div className="card mb-3 flex items-center gap-3 p-3">
        <Link to="/messages" className="text-ink-400 hover:text-ink-700" aria-label="Back to messages">
          <ArrowLeft size={18} />
        </Link>
        <Link to={`/classifieds/${conversation.listing.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-ink-300">
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={15} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-900">{conversation.listing.title}</span>
            <span className="block text-xs text-ink-500">
              with {conversation.otherParty.firstName} {conversation.otherParty.lastName}
            </span>
          </span>
        </Link>
      </div>

      <div className="card flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-800"
                }`}
              >
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-brand-100" : "text-ink-400"}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
          className="input flex-1"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-4 py-2.5 text-sm shrink-0">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
