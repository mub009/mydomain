import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, MapPin, PackageSearch, Plus } from "lucide-react";
import { b2bApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Category, Rfq } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { ListSkeleton } from "@/components/Loading";
import Pagination from "@/components/Pagination";

const RFQ_STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700",
  QUOTED: "bg-sky-50 text-sky-700",
  AWARDED: "bg-brand-50 text-brand-700",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function B2BMarketplace() {
  const user = useAuthStore((s) => s.user);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    quantity: 1,
    city: "",
    state: "",
  });

  function load() {
    setLoading(true);
    b2bApi
      .list({ page })
      .then((r) => {
        setRfqs(r.data);
        setTotalPages(r.meta.totalPages);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    categoriesApi.list().then(setCategories);
  }, []);

  async function submitRfq(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await b2bApi.create(form);
      setNotice("RFQ posted. Suppliers can now submit quotes.");
      load();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-8 mb-6">
        <span className="badge bg-white/15 text-white mb-2">
          <Briefcase size={13} /> B2B Marketplace
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Sourcing made simple</h1>
        <p className="text-brand-50/90 text-sm mt-1">Post a request, get competing quotes from verified suppliers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-ink-900 mb-3">Open requests</h2>
          {loading && <ListSkeleton rows={4} />}
          {!loading && (
          <div className="space-y-3">
            {rfqs.map((r) => (
              <Link key={r.id} to={`/b2b/${r.id}`} className="card block p-4 hover:shadow-card-hover transition-shadow">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-ink-900">{r.title}</h3>
                  <span className={`badge shrink-0 ${RFQ_STATUS_CLASS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-ink-500 mt-1 flex items-center gap-1">
                  <MapPin size={13} />
                  {r.city}, {r.state} · Qty: {r.quantity}
                </p>
                <p className="text-sm text-ink-700 mt-2 line-clamp-2">{r.description}</p>
              </Link>
            ))}
            {rfqs.length === 0 && (
              <div className="card p-10 text-center text-ink-500">
                <PackageSearch size={28} className="mx-auto mb-2 text-gray-300" />
                No open RFQs right now.
              </div>
            )}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
          )}
        </div>

        <div>
          {user ? (
            <form onSubmit={submitRfq} className="card p-5 space-y-3 sticky top-20">
              <h2 className="font-bold text-ink-900 flex items-center gap-1.5">
                <Plus size={16} className="text-brand-600" /> Post a Request for Quote
              </h2>
              {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">{notice}</p>}
              <input
                required
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
              />
              <textarea
                required
                placeholder="Describe what you need"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input min-h-20"
              />
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="input"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="input"
              />
              <div className="flex gap-3">
                <input
                  required
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="input w-1/2"
                />
                <input
                  required
                  placeholder="State"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="input w-1/2"
                />
              </div>
              <button className="btn-primary w-full py-2.5">Post RFQ</button>
            </form>
          ) : (
            <div className="card p-6 text-center text-sm text-ink-500">Log in to post an RFQ.</div>
          )}
        </div>
      </div>
    </div>
  );
}
