import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { analyticsApi } from "@/api/endpoints";
import { getVisitorId } from "@/lib/visitorId";

// Pings the backend on every route change, powering the admin Analytics
// tab's "online now" and "most visited pages" views. Fire-and-forget: a
// failed or slow ping must never affect navigation or be shown to the
// visitor, so its promise is deliberately left unawaited and its error
// swallowed.
export function usePageViewTracking(): void {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (lastPath.current === path) return;
    lastPath.current = path;

    analyticsApi.pageview({ visitorId: getVisitorId(), path, referrer: document.referrer || undefined }).catch(() => undefined);
  }, [location.pathname, location.search]);
}
