import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Flag, Plus, Search, Tag, Trash2, XCircle } from "lucide-react";
import { adminApi, classifiedCategoriesApi, classifiedReportsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedCategory, ClassifiedListing, ClassifiedReport, ClassifiedReportStatus, ClassifiedStatus } from "@/types";
import { money } from "@/components/ClassifiedCard";
import { ListSkeleton } from "@/components/Loading";
import Pagination from "@/components/Pagination";

const STATUS_TABS: { value: ClassifiedStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "SOLD", label: "Sold" },
  { value: "PAUSED", label: "Paused" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REMOVED", label: "Removed" },
];

const STATUS_TINT: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SOLD: "bg-gray-800 text-white",
  PAUSED: "bg-amber-50 text-amber-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  REMOVED: "bg-red-50 text-red-700",
};

function CategoriesSection() {
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    classifiedCategoriesApi.list().then(setCategories).catch((e) => setError(apiErrorMessage(e)));
  }

  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await classifiedCategoriesApi.create({ name, slug });
      setName("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Listings using it will keep the reference.")) return;
    try {
      await classifiedCategoriesApi.remove(id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name (e.g. Mobiles)"
          className="input flex-1"
        />
        <button disabled={saving} className="btn-primary px-4 py-2 text-sm shrink-0">
          <Plus size={15} /> Add
        </button>
      </form>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="card mt-4 divide-y divide-gray-100">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 p-3">
            <span className="flex items-center gap-1.5 text-sm text-ink-800">
              <Tag size={13} className="text-ink-400" /> {c.name}
            </span>
            <button onClick={() => remove(c.id)} className="text-xs font-semibold text-red-600 hover:underline">
              Delete
            </button>
          </div>
        ))}
        {categories.length === 0 && <p className="p-4 text-center text-sm text-ink-500">No categories yet.</p>}
      </div>
    </div>
  );
}

function ListingsSection() {
  const [status, setStatus] = useState<ClassifiedStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi
      .classifieds({ status: status || undefined, search: search || undefined, page })
      .then((r) => {
        setItems(r.data);
        setTotalPages(r.meta.totalPages);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, page]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await adminApi.removeClassified(id);
      setItems((prev) => prev.map((l) => (l.id === id ? { ...l, status: "REMOVED" } : l)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function destroy(id: string) {
    if (!confirm("Permanently delete this listing?")) return;
    setBusyId(id);
    try {
      await adminApi.deleteClassified(id);
      setItems((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" className="input" />
          <button className="btn-secondary px-3 py-2 text-sm">
            <Search size={14} />
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
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
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3">
        {loading && <ListSkeleton rows={5} />}
        {!loading && (
          <div className="card divide-y divide-gray-100">
            {items.map((l) => (
              <div key={l.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-ink-900">
                    <span className="truncate">{l.title}</span>
                    <span className={`badge shrink-0 ${STATUS_TINT[l.status] ?? "bg-gray-100 text-gray-600"}`}>{l.status}</span>
                  </p>
                  <p className="text-xs text-ink-500">
                    {money(l.priceCents, l.currency)} · {l.city} ·{" "}
                    {l.seller ? `${l.seller.firstName} ${l.seller.lastName}` : "Unknown seller"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {l.status !== "REMOVED" && (
                    <button
                      disabled={busyId === l.id}
                      onClick={() => remove(l.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      <XCircle size={13} /> Remove
                    </button>
                  )}
                  <button
                    disabled={busyId === l.id}
                    onClick={() => destroy(l.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="p-6 text-center text-sm text-ink-500">No listings match this filter.</p>}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

const REPORT_STATUS_TABS: { value: ClassifiedReportStatus | ""; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "", label: "All" },
];

const REASON_LABEL: Record<string, string> = {
  PROHIBITED_ITEM: "Prohibited item",
  SCAM_FRAUD: "Scam or fraud",
  INAPPROPRIATE: "Inappropriate content",
  SPAM: "Spam or duplicate",
  OTHER: "Other",
};

function ReportsSection() {
  const [status, setStatus] = useState<ClassifiedReportStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ClassifiedReport[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    classifiedReportsApi
      .list({ status: status || undefined, page })
      .then((r) => {
        setItems(r.data);
        setTotalPages(r.meta.totalPages);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, page]);

  async function updateStatus(id: string, next: "REVIEWED" | "DISMISSED") {
    setBusyId(id);
    try {
      await classifiedReportsApi.updateStatus(id, next);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {REPORT_STATUS_TABS.map((t) => (
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

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3">
        {loading && <ListSkeleton rows={5} />}
        {!loading && (
          <div className="card divide-y divide-gray-100">
            {items.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-ink-900">
                    <Flag size={13} className="shrink-0 text-red-500" />
                    <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                  </p>
                  <p className="text-xs text-ink-500">
                    {r.listing ? (
                      <Link to={`/classifieds/${r.listing.id}`} target="_blank" className="hover:underline">
                        {r.listing.title}
                      </Link>
                    ) : (
                      "Listing deleted"
                    )}
                    {r.reporter ? ` · reported by ${r.reporter.firstName} ${r.reporter.lastName}` : ""}
                  </p>
                  {r.message && <p className="mt-1 text-sm text-ink-700">{r.message}</p>}
                </div>
                {r.status === "PENDING" && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => updateStatus(r.id, "REVIEWED")}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle2 size={13} /> Reviewed
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => updateStatus(r.id, "DISMISSED")}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-gray-50"
                    >
                      <XCircle size={13} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="p-6 text-center text-sm text-ink-500">No reports in this filter.</p>}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

export default function ClassifiedsAdminPanel() {
  const [tab, setTab] = useState<"listings" | "categories" | "reports">("listings");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(["listings", "categories", "reports"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "listings" && <ListingsSection />}
      {tab === "categories" && <CategoriesSection />}
      {tab === "reports" && <ReportsSection />}
    </div>
  );
}
