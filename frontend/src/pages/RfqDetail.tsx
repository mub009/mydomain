import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Award, MapPin, MessageSquare, Package, Truck } from "lucide-react";
import { b2bApi, businessesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Rfq } from "@/types";
import { useAuthStore } from "@/store/authStore";

const RFQ_STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700",
  QUOTED: "bg-sky-50 text-sky-700",
  AWARDED: "bg-brand-50 text-brand-700",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
};

const QUOTE_STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "bg-sky-50 text-sky-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  WITHDRAWN: "bg-gray-100 text-gray-600",
};

export default function RfqDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [notice, setNotice] = useState("");
  const [quoteForm, setQuoteForm] = useState({ businessId: "", priceCents: 0, deliveryDays: 7, message: "" });

  function load() {
    if (!id) return;
    b2bApi.get(id).then(setRfq).catch((err) => setNotice(apiErrorMessage(err)));
  }

  useEffect(() => {
    load();
    if (user?.role === "BUSINESS_OWNER") businessesApi.mine({ pageSize: 50 }).then((r) => setMyBusinesses(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await b2bApi.submitQuote(id!, quoteForm);
      setNotice("Quote submitted.");
      load();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  async function award(quoteId: string) {
    try {
      await b2bApi.awardQuote(id!, quoteId);
      load();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  if (!rfq) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-1/3 rounded bg-gray-200 animate-pulse" />
        <div className="h-24 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <div className="lg:col-span-2">
        <div className="card p-5">
          <div className="flex justify-between items-start gap-2">
            <h1 className="text-2xl font-extrabold text-ink-900">{rfq.title}</h1>
            <span className={`badge shrink-0 ${RFQ_STATUS_CLASS[rfq.status] ?? "bg-gray-100 text-gray-600"}`}>
              {rfq.status}
            </span>
          </div>
          <p className="text-sm text-ink-500 mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={13} /> {rfq.city}, {rfq.state}</span>
            <span className="flex items-center gap-1"><Package size={13} /> Qty: {rfq.quantity}</span>
            <span>{rfq.category?.name}</span>
          </p>
          <p className="mt-4 text-sm text-ink-700 leading-relaxed">{rfq.description}</p>
        </div>

        <h2 className="text-lg font-bold text-ink-900 mt-8 mb-3 flex items-center gap-1.5">
          <MessageSquare size={17} className="text-brand-600" /> Quotes ({rfq.quotes?.length ?? 0})
        </h2>
        <div className="space-y-2">
          {rfq.quotes?.map((q) => (
            <div key={q.id} className="card p-4 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-ink-900">{q.business?.name}</p>
                <p className="text-sm text-ink-600 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-brand-700">
                    {q.currency} {(q.priceCents / 100).toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1 text-ink-500">
                    <Truck size={13} /> {q.deliveryDays ?? "—"} days
                  </span>
                  <span className={`badge ${QUOTE_STATUS_CLASS[q.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {q.status}
                  </span>
                </p>
                {q.message && <p className="text-sm text-ink-500 mt-1">{q.message}</p>}
              </div>
              {q.status === "SUBMITTED" && (
                <button onClick={() => award(q.id)} className="btn-primary text-sm px-3.5 py-2 shrink-0">
                  <Award size={14} /> Award
                </button>
              )}
            </div>
          ))}
          {(!rfq.quotes || rfq.quotes.length === 0) && (
            <div className="card p-8 text-center text-sm text-ink-500">No quotes yet.</div>
          )}
        </div>
      </div>

      <div>
        {user?.role === "BUSINESS_OWNER" && myBusinesses.length > 0 && (
          <form onSubmit={submitQuote} className="card p-5 space-y-3 sticky top-20">
            <h2 className="font-bold text-ink-900">Submit a quote</h2>
            {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">{notice}</p>}
            <select
              required
              value={quoteForm.businessId}
              onChange={(e) => setQuoteForm({ ...quoteForm, businessId: e.target.value })}
              className="input"
            >
              <option value="">Quote as…</option>
              {myBusinesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min={0}
              placeholder="Price (in cents)"
              value={quoteForm.priceCents}
              onChange={(e) => setQuoteForm({ ...quoteForm, priceCents: Number(e.target.value) })}
              className="input"
            />
            <input
              type="number"
              min={0}
              placeholder="Delivery (days)"
              value={quoteForm.deliveryDays}
              onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDays: Number(e.target.value) })}
              className="input"
            />
            <textarea
              placeholder="Message to buyer"
              value={quoteForm.message}
              onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
              className="input min-h-20"
            />
            <button className="btn-primary w-full py-2.5">Submit quote</button>
          </form>
        )}
      </div>
    </div>
  );
}
