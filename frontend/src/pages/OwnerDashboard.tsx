import { useEffect, useState } from "react";
import { Building2, CalendarClock, LayoutGrid, MessageSquare, Plus } from "lucide-react";
import { businessesApi, categoriesApi, leadsApi, bookingsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category, Lead, Booking } from "@/types";

type Tab = "businesses" | "leads" | "bookings";

const TAB_META: Record<Tab, { label: string; icon: typeof LayoutGrid }> = {
  businesses: { label: "Businesses", icon: LayoutGrid },
  leads: { label: "Leads", icon: MessageSquare },
  bookings: { label: "Bookings", icon: CalendarClock },
};

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700",
    CONFIRMED: "bg-emerald-50 text-emerald-700",
    CONVERTED: "bg-emerald-50 text-emerald-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700",
    PENDING: "bg-amber-50 text-amber-700",
    NEW: "bg-brand-50 text-brand-700",
    CONTACTED: "bg-sky-50 text-sky-700",
    QUALIFIED: "bg-violet-50 text-violet-700",
    DRAFT: "bg-gray-100 text-gray-600",
    SUSPENDED: "bg-red-50 text-red-700",
    CANCELLED: "bg-red-50 text-red-700",
    LOST: "bg-red-50 text-red-700",
    NO_SHOW: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

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
      <h1 className="text-2xl font-extrabold text-ink-900 mb-1">My Business Dashboard</h1>
      <p className="text-sm text-ink-500 mb-6">Manage your listings, leads, and bookings in one place.</p>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(Object.keys(TAB_META) as Tab[]).map((t) => {
          const meta = TAB_META[t];
          const Icon = meta.icon;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              <Icon size={15} /> {meta.label}
            </button>
          );
        })}
      </div>

      {tab === "businesses" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-bold text-ink-900 mb-3 flex items-center gap-1.5">
              <Building2 size={16} className="text-brand-600" /> Your listings
            </h2>
            <div className="space-y-2">
              {businesses.map((b) => (
                <div key={b.id} className="card p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-ink-900">{b.name}</p>
                    <span className={`badge ${statusBadgeClass(b.status)}`}>{b.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">
                    {b.city}, {b.state}
                  </p>
                </div>
              ))}
              {businesses.length === 0 && (
                <div className="card p-6 text-center text-sm text-ink-500">No businesses yet — add one to get started.</div>
              )}
            </div>
          </div>
          <form onSubmit={createBusiness} className="card p-5 space-y-3">
            <h2 className="font-bold text-ink-900 flex items-center gap-1.5">
              <Plus size={16} className="text-brand-600" /> Add a business
            </h2>
            {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">{notice}</p>}
            <input
              required
              placeholder="Business name"
              value={newBusiness.name}
              onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
              className="input"
            />
            <input
              required
              placeholder="URL slug (e.g. joes-plumbing)"
              value={newBusiness.slug}
              onChange={(e) => setNewBusiness({ ...newBusiness, slug: e.target.value })}
              className="input"
            />
            <select
              required
              value={newBusiness.categoryId}
              onChange={(e) => setNewBusiness({ ...newBusiness, categoryId: e.target.value })}
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
              required
              placeholder="Phone"
              value={newBusiness.phone}
              onChange={(e) => setNewBusiness({ ...newBusiness, phone: e.target.value })}
              className="input"
            />
            <input
              required
              placeholder="Address line 1"
              value={newBusiness.addressLine1}
              onChange={(e) => setNewBusiness({ ...newBusiness, addressLine1: e.target.value })}
              className="input"
            />
            <div className="flex gap-3">
              <input
                required
                placeholder="City"
                value={newBusiness.city}
                onChange={(e) => setNewBusiness({ ...newBusiness, city: e.target.value })}
                className="input w-1/2"
              />
              <input
                required
                placeholder="State"
                value={newBusiness.state}
                onChange={(e) => setNewBusiness({ ...newBusiness, state: e.target.value })}
                className="input w-1/2"
              />
            </div>
            <input
              required
              placeholder="Postal code"
              value={newBusiness.postalCode}
              onChange={(e) => setNewBusiness({ ...newBusiness, postalCode: e.target.value })}
              className="input"
            />
            <div className="flex gap-3">
              <input
                required
                placeholder="Latitude"
                value={newBusiness.latitude}
                onChange={(e) => setNewBusiness({ ...newBusiness, latitude: e.target.value })}
                className="input w-1/2"
              />
              <input
                required
                placeholder="Longitude"
                value={newBusiness.longitude}
                onChange={(e) => setNewBusiness({ ...newBusiness, longitude: e.target.value })}
                className="input w-1/2"
              />
            </div>
            <button className="btn-primary w-full py-2.5">Create listing</button>
          </form>
        </div>
      )}

      {(tab === "leads" || tab === "bookings") && (
        <div>
          <select
            value={selectedBusinessId}
            onChange={(e) => setSelectedBusinessId(e.target.value)}
            className="input sm:w-72 mb-4"
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
                <div key={l.id} className="card p-3.5 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-ink-900">
                      {l.name} <span className="text-ink-500 font-normal">— {l.phone}</span>
                    </p>
                    {l.message && <p className="text-sm text-ink-600 mt-0.5 truncate">{l.message}</p>}
                  </div>
                  <select
                    value={l.status}
                    onChange={(e) => updateLead(l.id, e.target.value)}
                    className={`badge border-0 shrink-0 ${statusBadgeClass(l.status)}`}
                  >
                    {["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {leads.length === 0 && <div className="card p-6 text-center text-sm text-ink-500">No leads yet.</div>}
            </div>
          )}

          {tab === "bookings" && (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="card p-3.5 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-ink-900">{b.service?.name}</p>
                    <p className="text-sm text-ink-500 mt-0.5">{new Date(b.scheduledAt).toLocaleString()}</p>
                  </div>
                  <select
                    value={b.status}
                    onChange={(e) => updateBooking(b.id, e.target.value)}
                    className={`badge border-0 shrink-0 ${statusBadgeClass(b.status)}`}
                  >
                    {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {bookings.length === 0 && <div className="card p-6 text-center text-sm text-ink-500">No bookings yet.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
