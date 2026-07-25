import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Eye,
  LayoutGrid,
  type LucideIcon,
  MapPin,
  MessageSquare,
  Plus,
  Settings2,
  Star,
  X,
} from "lucide-react";
import { businessesApi, categoriesApi, leadsApi, bookingsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category, Lead, Booking } from "@/types";
import { useAuthStore } from "@/store/authStore";
import BusinessManager from "@/components/BusinessManager";

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="text-2xl font-extrabold text-ink-900 mt-3 leading-none">{value}</p>
      <p className="text-xs text-ink-500 mt-1">{label}</p>
    </div>
  );
}

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
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("businesses");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notice, setNotice] = useState("");
  const [manageId, setManageId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

  const stats = useMemo(() => {
    const totalViews = businesses.reduce((s, b) => s + (b.viewCount ?? 0), 0);
    const totalLeads = businesses.reduce((s, b) => s + (b.leadCount ?? 0), 0);
    const ratedReviews = businesses.reduce((s, b) => s + b.reviewCount, 0);
    const weighted = businesses.reduce((s, b) => s + b.avgRating * b.reviewCount, 0);
    const avgRating = ratedReviews > 0 ? weighted / ratedReviews : 0;
    return { listings: businesses.length, totalViews, totalLeads, avgRating, ratedReviews };
  }, [businesses]);

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
      const created = await businessesApi.create({
        ...newBusiness,
        latitude: Number(newBusiness.latitude),
        longitude: Number(newBusiness.longitude),
        country: "IN",
      });
      setNotice("Business created. Manage its details, hours, services, and photos below.");
      setNewBusiness({ name: "", slug: "", categoryId: "", phone: "", addressLine1: "", city: "", state: "", postalCode: "", latitude: "", longitude: "" });
      setShowCreate(false);
      loadBusinesses();
      setManageId(created.id);
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
      {/* Header banner */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 px-6 py-6 sm:px-8 sm:py-7 mb-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none [background-image:radial-gradient(circle_at_15%_20%,white,transparent_35%),radial-gradient(circle_at_85%_80%,white,transparent_30%)]" />
        <div className="relative">
          <p className="text-brand-50/80 text-sm">Welcome back{user?.firstName ? `, ${user.firstName}` : ""} 👋</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">My Business Dashboard</h1>
          <p className="text-brand-50/80 text-sm mt-1">Manage your listings, leads, bookings, hours, and more.</p>
        </div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Building2} label="Active listings" value={stats.listings} tint="bg-brand-50 text-brand-600" />
        <StatCard icon={Eye} label="Total profile views" value={stats.totalViews} tint="bg-sky-50 text-sky-600" />
        <StatCard icon={MessageSquare} label="Leads received" value={stats.totalLeads} tint="bg-violet-50 text-violet-600" />
        <StatCard
          icon={Star}
          label={`Avg rating · ${stats.ratedReviews} reviews`}
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
          tint="bg-amber-50 text-amber-600"
        />
      </div>

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

      {tab === "businesses" && manageId && (
        <BusinessManager
          businessId={manageId}
          categories={categories}
          onBack={() => setManageId(null)}
          onChanged={loadBusinesses}
        />
      )}

      {tab === "businesses" && !manageId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-900 flex items-center gap-1.5">
              <Building2 size={16} className="text-brand-600" /> Your listings
            </h2>
            <button onClick={() => setShowCreate((v) => !v)} className={showCreate ? "btn-secondary px-3 py-2 text-sm" : "btn-primary px-3 py-2 text-sm"}>
              {showCreate ? (
                <>
                  <X size={15} /> Cancel
                </>
              ) : (
                <>
                  <Plus size={15} /> Add business
                </>
              )}
            </button>
          </div>

          {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2 mb-4">{notice}</p>}

          {showCreate && (
            <form onSubmit={createBusiness} className="card p-5 space-y-3 mb-6">
              <h3 className="font-bold text-ink-900">Add a business</h3>
              <p className="text-xs text-ink-500 -mt-2">Create the listing, then add hours, services, and photos.</p>
              <input required placeholder="Business name" value={newBusiness.name} onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })} className="input" />
              <input required placeholder="URL slug (e.g. joes-plumbing)" value={newBusiness.slug} onChange={(e) => setNewBusiness({ ...newBusiness, slug: e.target.value })} className="input" />
              <select required value={newBusiness.categoryId} onChange={(e) => setNewBusiness({ ...newBusiness, categoryId: e.target.value })} className="input">
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input required placeholder="Phone" value={newBusiness.phone} onChange={(e) => setNewBusiness({ ...newBusiness, phone: e.target.value })} className="input" />
              <input required placeholder="Address line 1" value={newBusiness.addressLine1} onChange={(e) => setNewBusiness({ ...newBusiness, addressLine1: e.target.value })} className="input" />
              <div className="flex gap-3">
                <input required placeholder="City" value={newBusiness.city} onChange={(e) => setNewBusiness({ ...newBusiness, city: e.target.value })} className="input w-1/2" />
                <input required placeholder="State" value={newBusiness.state} onChange={(e) => setNewBusiness({ ...newBusiness, state: e.target.value })} className="input w-1/2" />
              </div>
              <input required placeholder="Postal code" value={newBusiness.postalCode} onChange={(e) => setNewBusiness({ ...newBusiness, postalCode: e.target.value })} className="input" />
              <div className="flex gap-3">
                <input required placeholder="Latitude" value={newBusiness.latitude} onChange={(e) => setNewBusiness({ ...newBusiness, latitude: e.target.value })} className="input w-1/2" />
                <input required placeholder="Longitude" value={newBusiness.longitude} onChange={(e) => setNewBusiness({ ...newBusiness, longitude: e.target.value })} className="input w-1/2" />
              </div>
              <button className="btn-primary w-full py-2.5">Create listing</button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {businesses.map((b) => (
              <div key={b.id} className="card p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink-900">{b.name}</p>
                  <span className={`badge ${statusBadgeClass(b.status)}`}>{b.status.replace("_", " ")}</span>
                </div>
                <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                  <MapPin size={12} /> {b.city}, {b.state}
                </p>
                <button onClick={() => setManageId(b.id)} className="btn-secondary w-full mt-3 py-2 text-sm">
                  <Settings2 size={15} /> Manage
                </button>
              </div>
            ))}
            {businesses.length === 0 && !showCreate && (
              <div className="card p-8 text-center text-sm text-ink-500 sm:col-span-2">
                No businesses yet — click “Add business” to get started.
              </div>
            )}
          </div>
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
