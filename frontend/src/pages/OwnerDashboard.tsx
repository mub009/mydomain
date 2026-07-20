import { useEffect, useState } from "react";
import { businessesApi, categoriesApi, leadsApi, bookingsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category, Lead, Booking } from "@/types";

type Tab = "businesses" | "leads" | "bookings";

export default function OwnerDashboard() {
  const [tab, setTab] = useState<Tab>("businesses");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notice, setNotice] = useState("");

  const [newBusiness, setNewBusiness] = useState({
    name: "",
    slug: "",
    categoryId: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: "",
    longitude: "",
  });

  function loadBusinesses() {
    businessesApi.mine().then((list) => {
      setBusinesses(list);
      if (list.length && !selectedBusinessId) setSelectedBusinessId(list[0].id);
    });
  }

  useEffect(() => {
    loadBusinesses();
    categoriesApi.list().then(setCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBusinessId) return;
    if (tab === "leads") leadsApi.listForBusiness(selectedBusinessId).then((r) => setLeads(r.data));
    if (tab === "bookings") bookingsApi.forBusiness(selectedBusinessId).then((r) => setBookings(r.data));
  }, [tab, selectedBusinessId]);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await businessesApi.create({
        ...newBusiness,
        latitude: Number(newBusiness.latitude),
        longitude: Number(newBusiness.longitude),
        country: "IN",
      });
      setNotice("Business created and submitted for approval.");
      loadBusinesses();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  async function updateLead(leadId: string, status: string) {
    await leadsApi.updateStatus(leadId, status);
    if (selectedBusinessId) leadsApi.listForBusiness(selectedBusinessId).then((r) => setLeads(r.data));
  }

  async function updateBooking(bookingId: string, status: string) {
    await bookingsApi.updateStatus(bookingId, status);
    if (selectedBusinessId) bookingsApi.forBusiness(selectedBusinessId).then((r) => setBookings(r.data));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Business Dashboard</h1>
      <div className="flex gap-2 mb-6">
        {(["businesses", "leads", "bookings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm capitalize ${tab === t ? "bg-brand-600 text-white" : "bg-white border"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "businesses" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-semibold mb-2">Your listings</h2>
            <div className="space-y-2">
              {businesses.map((b) => (
                <div key={b.id} className="border rounded-md p-3 bg-white">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-gray-500">
                    {b.city}, {b.state} — status: {b.status}
                  </p>
                </div>
              ))}
              {businesses.length === 0 && <p className="text-sm text-gray-500">No businesses yet — add one.</p>}
            </div>
          </div>
          <form onSubmit={createBusiness} className="border rounded-md p-4 bg-white space-y-3">
            <h2 className="font-semibold">Add a business</h2>
            {notice && <p className="text-sm text-brand-700">{notice}</p>}
            <input
              required
              placeholder="Business name"
              value={newBusiness.name}
              onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <input
              required
              placeholder="URL slug (e.g. joes-plumbing)"
              value={newBusiness.slug}
              onChange={(e) => setNewBusiness({ ...newBusiness, slug: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <select
              required
              value={newBusiness.categoryId}
              onChange={(e) => setNewBusiness({ ...newBusiness, categoryId: e.target.value })}
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
              required
              placeholder="Phone"
              value={newBusiness.phone}
              onChange={(e) => setNewBusiness({ ...newBusiness, phone: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <input
              required
              placeholder="Address line 1"
              value={newBusiness.addressLine1}
              onChange={(e) => setNewBusiness({ ...newBusiness, addressLine1: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <div className="flex gap-3">
              <input
                required
                placeholder="City"
                value={newBusiness.city}
                onChange={(e) => setNewBusiness({ ...newBusiness, city: e.target.value })}
                className="w-1/2 border rounded-md px-3 py-2"
              />
              <input
                required
                placeholder="State"
                value={newBusiness.state}
                onChange={(e) => setNewBusiness({ ...newBusiness, state: e.target.value })}
                className="w-1/2 border rounded-md px-3 py-2"
              />
            </div>
            <input
              required
              placeholder="Postal code"
              value={newBusiness.postalCode}
              onChange={(e) => setNewBusiness({ ...newBusiness, postalCode: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
            />
            <div className="flex gap-3">
              <input
                required
                placeholder="Latitude"
                value={newBusiness.latitude}
                onChange={(e) => setNewBusiness({ ...newBusiness, latitude: e.target.value })}
                className="w-1/2 border rounded-md px-3 py-2"
              />
              <input
                required
                placeholder="Longitude"
                value={newBusiness.longitude}
                onChange={(e) => setNewBusiness({ ...newBusiness, longitude: e.target.value })}
                className="w-1/2 border rounded-md px-3 py-2"
              />
            </div>
            <button className="w-full bg-brand-600 text-white rounded-md py-2">Create listing</button>
          </form>
        </div>
      )}

      {(tab === "leads" || tab === "bookings") && (
        <div>
          <select
            value={selectedBusinessId}
            onChange={(e) => setSelectedBusinessId(e.target.value)}
            className="border rounded-md px-3 py-2 mb-4"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {tab === "leads" && (
            <div className="space-y-2">
              {leads.map((l) => (
                <div key={l.id} className="border rounded-md p-3 bg-white flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {l.name} — {l.phone}
                    </p>
                    {l.message && <p className="text-sm text-gray-600">{l.message}</p>}
                  </div>
                  <select
                    value={l.status}
                    onChange={(e) => updateLead(l.id, e.target.value)}
                    className="border rounded-md px-2 py-1 text-sm"
                  >
                    {["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {leads.length === 0 && <p className="text-sm text-gray-500">No leads yet.</p>}
            </div>
          )}

          {tab === "bookings" && (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="border rounded-md p-3 bg-white flex justify-between items-center">
                  <div>
                    <p className="font-medium">{b.service?.name}</p>
                    <p className="text-sm text-gray-600">{new Date(b.scheduledAt).toLocaleString()}</p>
                  </div>
                  <select
                    value={b.status}
                    onChange={(e) => updateBooking(b.id, e.target.value)}
                    className="border rounded-md px-2 py-1 text-sm"
                  >
                    {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {bookings.length === 0 && <p className="text-sm text-gray-500">No bookings yet.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
