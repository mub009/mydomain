import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImageIcon, MessageCircle } from "lucide-react";
import { classifiedMessagesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedConversation } from "@/types";
import { ListSkeleton } from "@/components/Loading";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Messages() {
  const [conversations, setConversations] = useState<ClassifiedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    classifiedMessagesApi
      .conversations({ pageSize: 50 })
      .then((r) => setConversations(r.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-bold text-ink-900">Messages</h1>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <ListSkeleton rows={5} />}

      {!loading && conversations.length === 0 && !error && (
        <div className="card p-10 text-center">
          <MessageCircle size={28} className="mx-auto text-ink-300" />
          <p className="mt-3 text-sm text-ink-500">No conversations yet.</p>
          <Link to="/classifieds" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Browse listings
          </Link>
        </div>
      )}

      {!loading && conversations.length > 0 && (
        <div className="card divide-y divide-gray-100">
          {conversations.map((c) => {
            const photo = c.listing.photos?.[0]?.url;
            return (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-ink-300">
                  {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread ? "font-bold text-ink-900" : "font-semibold text-ink-800"}`}>
                      {c.otherParty.firstName} {c.otherParty.lastName}
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(c.lastMessageAt)}</span>
                  </p>
                  <p className="truncate text-xs text-ink-500">{c.listing.title}</p>
                  <p className={`truncate text-sm ${c.unread ? "font-semibold text-ink-800" : "text-ink-500"}`}>
                    {c.lastMessage}
                  </p>
                </div>
                {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
