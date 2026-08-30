import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, Pause, Play, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedListing, ClassifiedStatus } from "@/types";
import { CardSkeleton } from "@/components/Loading";
import Pagination from "@/components/Pagination";
import { money } from "@/components/ClassifiedCard";

const STATUS_TABS: { value: ClassifiedStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "SOLD", label: "Sold" },
  { value: "EXPIRED", label: "Expired" },
];

const STATUS_TINT: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SOLD: "bg-gray-800 text-white",
  PAUSED: "bg-amber-50 text-amber-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  REMOVED: "bg-red-50 text-red-700",
};

export default function MyListings() {
  const [status, setStatus] = useState<ClassifiedStatus | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    classifiedsApi
      .mine({ status: status || undefined, page })
      .then((r) => {
        setItems(r.data);
        setTotalPages(r.meta.totalPages);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, page]);

  async function runAction(id: string, action: (id: string) => Promise<ClassifiedListing>) {
    setBusyId(id);
    try {
      const updated = await action(id);
      setItems((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await classifiedsApi.remove(id);
      setItems((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink-900">My listings</h1>
        <Link to="/classifieds/new" className="btn-primary px-4 py-2.5 text-sm">
          <Plus size={15} /> Sell an item
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            className={`badge ${status === t.value ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4">
        {loading && <CardSkeleton count={4} className="space-y-3" />}

        {!loading && (
          <div className="space-y-3">
            {items.map((l) => {
              const photo = l.photos?.[0]?.url;
              const isBusy = busyId === l.id;
              return (
                <div key={l.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/classifieds/${l.id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {photo ? <img src={photo} alt={l.title} className="h-full w-full object-cover" /> : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/classifieds/${l.id}`} className="truncate font-semibold text-ink-900 hover:text-brand-600">
                        {l.title}
                      </Link>
                      <span className={`badge shrink-0 ${STATUS_TINT[l.status] ?? "bg-gray-100 text-gray-600"}`}>{l.status}</span>
                    </div>
                    <p className="text-sm font-bold text-ink-900">{money(l.priceCents, l.currency)}</p>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                      <span className="flex items-center gap-1">
                        <Eye size={11} /> {l.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={11} /> {l.favoriteCount}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                    <Link to={`/classifieds/${l.id}/edit`} className="btn-secondary px-2.5 py-1.5 text-xs">
                      <Settings2 size={13} /> Edit
                    </Link>
                    {l.status === "ACTIVE" && (
                      <>
                        <button
                          disabled={isBusy}
                          onClick={() => runAction(l.id, classifiedsApi.markSold)}
                          className="btn-secondary px-2.5 py-1.5 text-xs"
                        >
                          Mark sold
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => runAction(l.id, classifiedsApi.pause)}
                          className="btn-secondary px-2.5 py-1.5 text-xs"
                        >
                          <Pause size={13} /> Pause
                        </button>
                      </>
                    )}
                    {(l.status === "PAUSED" || l.status === "EXPIRED") && (
                      <button
                        disabled={isBusy}
                        onClick={() => runAction(l.id, classifiedsApi.activate)}
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                      >
                        <Play size={13} /> Resume
                      </button>
                    )}
                    {l.status !== "SOLD" && (
                      <button
                        disabled={isBusy}
                        onClick={() => runAction(l.id, classifiedsApi.renew)}
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                      >
                        <RefreshCw size={13} /> Renew
                      </button>
                    )}
                    <button
                      disabled={isBusy}
                      onClick={() => remove(l.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="card py-14 text-center text-sm text-ink-500">
                No listings here yet.{" "}
                <Link to="/classifieds/new" className="font-semibold text-brand-600 hover:underline">
                  Post your first item
                </Link>
                .
              </div>
            )}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
