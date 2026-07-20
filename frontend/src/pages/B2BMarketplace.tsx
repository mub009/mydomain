import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { b2bApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Category, Rfq } from "@/types";
import { useAuthStore } from "@/store/authStore";

export default function B2BMarketplace() {
  const user = useAuthStore((s) => s.user);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
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
    b2bApi.list().then((r) => setRfqs(r.data));
  }

  useEffect(() => {
    load();
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold mb-4">B2B Marketplace — Open RFQs</h1>
        <div className="space-y-3">
          {rfqs.map((r) => (
            <Link key={r.id} to={`/b2b/${r.id}`} className="block border rounded-md p-4 bg-white hover:shadow-md">
              <div className="flex justify-between">
                <h3 className="font-semibold">{r.title}</h3>
                <span className="text-xs bg-gray-100 rounded px-2 py-1">{r.status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {r.city}, {r.state} · Qty: {r.quantity}
              </p>
              <p className="text-sm text-gray-700 mt-2 line-clamp-2">{r.description}</p>
            </Link>
          ))}
          {rfqs.length === 0 && <p className="text-gray-500">No open RFQs right now.</p>}
        </div>
      </div>

      <div>
        {user ? (
          <form onSubmit={submitRfq} className="border rounded-md p-4 bg-white space-y-3 sticky top-20">
            <h2 className="font-semibold">Post a Request for Quote</h2>
            {notice && <p className="text-sm text-brand-700">{notice}</p>}
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <textarea
              required
              placeholder="Describe what you need"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
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
              className="w-full border rounded-md px-3 py-2"
            />
            <div className="flex gap-3">
              <input
                required
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-1/2 border rounded-md px-3 py-2"
              />
              <input
                required
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-1/2 border rounded-md px-3 py-2"
              />
            </div>
            <button className="w-full bg-brand-600 text-white rounded-md py-2">Post RFQ</button>
          </form>
        ) : (
          <p className="text-sm text-gray-500">Log in to post an RFQ.</p>
        )}
      </div>
    </div>
  );
}
