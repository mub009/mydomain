import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { b2bApi, businessesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Rfq } from "@/types";
import { useAuthStore } from "@/store/authStore";

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
    if (user?.role === "BUSINESS_OWNER") businessesApi.mine().then(setMyBusinesses);
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

  if (!rfq) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold">{rfq.title}</h1>
          <span className="text-xs bg-gray-100 rounded px-2 py-1">{rfq.status}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {rfq.city}, {rfq.state} · Qty: {rfq.quantity} · {rfq.category?.name}
        </p>
        <p className="mt-4 text-gray-700">{rfq.description}</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">Quotes ({rfq.quotes?.length ?? 0})</h2>
        <div className="space-y-2">
          {rfq.quotes?.map((q) => (
            <div key={q.id} className="border rounded-md p-3 bg-white flex justify-between items-center">
              <div>
                <p className="font-medium">{q.business?.name}</p>
                <p className="text-sm text-gray-600">
                  {q.currency} {(q.priceCents / 100).toFixed(2)} · {q.deliveryDays ?? "—"} days · {q.status}
                </p>
                {q.message && <p className="text-sm text-gray-500 mt-1">{q.message}</p>}
              </div>
              {q.status === "SUBMITTED" && (
                <button onClick={() => award(q.id)} className="text-sm bg-brand-600 text-white rounded-md px-3 py-1.5">
                  Award
                </button>
              )}
            </div>
          ))}
          {(!rfq.quotes || rfq.quotes.length === 0) && <p className="text-sm text-gray-500">No quotes yet.</p>}
        </div>
      </div>

      <div>
        {user?.role === "BUSINESS_OWNER" && myBusinesses.length > 0 && (
          <form onSubmit={submitQuote} className="border rounded-md p-4 bg-white space-y-3 sticky top-20">
            <h2 className="font-semibold">Submit a quote</h2>
            {notice && <p className="text-sm text-brand-700">{notice}</p>}
            <select
              required
              value={quoteForm.businessId}
              onChange={(e) => setQuoteForm({ ...quoteForm, businessId: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
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
              className="w-full border rounded-md px-3 py-2"
            />
            <input
              type="number"
              min={0}
              placeholder="Delivery (days)"
              value={quoteForm.deliveryDays}
              onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDays: Number(e.target.value) })}
              className="w-full border rounded-md px-3 py-2"
            />
            <textarea
              placeholder="Message to buyer"
              value={quoteForm.message}
              onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <button className="w-full bg-brand-600 text-white rounded-md py-2">Submit quote</button>
          </form>
        )}
      </div>
    </div>
  );
}
