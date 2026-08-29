import { useEffect, useState } from "react";
import { Globe, Laptop, Monitor, Radio, Smartphone, Tablet, TrendingUp, User } from "lucide-react";
import { analyticsApi, OnlineVisitor, PageStat } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ListSkeleton } from "@/components/Loading";

const ONLINE_POLL_MS = 15000;
const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
] as const;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function DeviceIcon({ device }: { device: string | null }) {
  if (device === "Mobile") return <Smartphone size={14} className="text-ink-400" />;
  if (device === "Tablet") return <Tablet size={14} className="text-ink-400" />;
  if (device === "Desktop") return <Monitor size={14} className="text-ink-400" />;
  return <Laptop size={14} className="text-ink-400" />;
}

function OnlineNow() {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    analyticsApi
      .online()
      .then((r) => setVisitors(r.online))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, ONLINE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
          <Radio size={16} className="text-emerald-600" />
          Online now
        </h3>
        <span className="badge bg-emerald-50 text-emerald-700">{visitors.length} active</span>
      </div>

      {loading && <ListSkeleton rows={3} />}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && visitors.length === 0 && <p className="text-sm text-ink-500">No one online right now.</p>}

      {!loading && visitors.length > 0 && (
        <div className="divide-y divide-gray-100">
          {visitors.map((v) => (
            <div key={v.visitorId} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-ink-900">{v.path}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="flex items-center gap-1">
                    <Globe size={12} className="text-ink-400" />
                    {v.location ?? "Unknown location"}
                  </span>
                  <span className="flex items-center gap-1">
                    <DeviceIcon device={v.device} />
                    {v.browser ?? "Unknown"} · {v.device ?? "Unknown"}
                  </span>
                  {v.loggedIn && (
                    <span className="flex items-center gap-1 text-brand-600">
                      <User size={12} /> Signed in
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-ink-400">
                <p className="font-mono">{v.ip}</p>
                <p>{timeAgo(v.lastSeenAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MostVisitedPages() {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7d");
  const [pages, setPages] = useState<PageStat[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    analyticsApi
      .pages(range)
      .then((r) => {
        setPages(r.pages);
        setTotalViews(r.totalViews);
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [range]);

  const maxViews = Math.max(1, ...pages.map((p) => p.views));

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
          <TrendingUp size={16} className="text-brand-600" />
          Most visited pages
        </h3>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                range === r.value ? "bg-white text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <ListSkeleton rows={4} />}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && pages.length === 0 && <p className="text-sm text-ink-500">No page views recorded in this range yet.</p>}

      {!loading && pages.length > 0 && (
        <>
          <p className="mb-3 text-xs text-ink-500">{totalViews.toLocaleString("en-IN")} total views</p>
          <div className="space-y-2.5">
            {pages.map((p) => (
              <div key={p.path}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-mono text-ink-800">{p.path}</span>
                  <span className="shrink-0 text-xs text-ink-500">
                    {p.views.toLocaleString("en-IN")} views · {p.uniqueVisitors.toLocaleString("en-IN")} unique
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPanel() {
  return (
    <div className="space-y-4">
      <OnlineNow />
      <MostVisitedPages />
    </div>
  );
}
