import { useEffect, useState } from "react";
import { classifiedMessagesApi } from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";

const POLL_MS = 30_000;

// Backs the unread-message badge in the nav. Only signed-in users have an
// inbox, so this is a no-op (and never polls) while logged out.
export function useUnreadMessageCount(): number {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const poll = () => {
      classifiedMessagesApi
        .unreadCount()
        .then((r) => {
          if (!cancelled) setCount(r.count);
        })
        .catch(() => undefined);
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken]);

  return count;
}
