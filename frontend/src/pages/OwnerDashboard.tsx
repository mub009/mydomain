import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Eye,
  KeyRound,
  LayoutGrid,
  type LucideIcon,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings2,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { businessesApi, categoriesApi, leadsApi, bookingsApi, usersApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { AdminUser, Business, Category, Lead, Booking, Privilege } from "@/types";
import { useAuthStore } from "@/store/authStore";
import BusinessManager from "@/components/BusinessManager";
import Pagination from "@/components/Pagination";
import ResetPasswordModal, { CopyField, generatePassword } from "@/components/ResetPasswordModal";

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

const TAB_META: Record<Tab, { label: string; icon: typeof LayoutGrid; privilege: Privilege }> = {
  businesses: { label: "Businesses", icon: LayoutGrid, privilege: "MANAGE_LISTINGS" },
  leads: { label: "Leads", icon: MessageSquare, privilege: "MANAGE_LEADS" },
  bookings: { label: "Bookings", icon: CalendarClock, privilege: "MANAGE_BOOKINGS" },
};

interface OwnerCreds {
  businessName: string;
  username: string;
  password: string;
  created: boolean;
}

// Shown after a dealer/admin creates a listing with a login for the business
// team, so the credentials can be handed over.
function OwnerCredsCard({ creds, onDismiss }: { creds: OwnerCreds; onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-emerald-800 flex items-center gap-1.5">
          <KeyRound size={16} /> Login for “{creds.businessName}”
        </p>
        <button type="button" onClick={onDismiss} className="text-xs text-emerald-700/70 hover:text-emerald-900 underline">
          Dismiss
        </button>
      </div>
      <p className="text-xs text-emerald-700/90 mt-1 mb-3">
        {creds.created
          ? "A welcome email with these login details has been sent to the owner. You can also share them directly — the password won't be shown here again."
          : "This listing was linked to an existing account — the business team signs in with the email below and their existing password. A welcome email has been sent."}
      </p>
      <div className="space-y-2.5">
        <CopyField label="Username (email)" value={creds.username} />
        {creds.created && <CopyField label="Password" value={creds.password} />}
      </div>
    </div>
  );
}

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

  // Dealers are gated by their granted privileges; business owners and admins
  // implicitly hold every privilege on their own resources.
  const isDealer = user?.role === "DEALER";
  const can = (p: Privilege) => !isDealer || (user?.privileges ?? []).includes(p);
  const canManageListings = can("MANAGE_LISTINGS");
  const visibleTabs = (Object.keys(TAB_META) as Tab[]).filter((t) => can(TAB_META[t].privilege));

  const [tab, setTab] = useState<Tab>(visibleTabs[0] ?? "businesses");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bizPage, setBizPage] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotalPages, setLeadsTotalPages] = useState(1);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsTotalPages, setBookingsTotalPages] = useState(1);
  const [notice, setNotice] = useState("");
  const [createError, setCreateError] = useState("");
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

  // Dealers/admins can create a login for the business team while adding the
  // listing; the listing is then assigned to that account.
  const canAssignOwner = isDealer || user?.role === "ADMIN";
  const emptyOwnerAccount = { firstName: "", lastName: "", email: "", phone: "", password: "" };
  const [withOwner, setWithOwner] = useState(isDealer);
  const [ownerAccount, setOwnerAccount] = useState(emptyOwnerAccount);
  const [ownerCreds, setOwnerCreds] = useState<OwnerCreds | null>(null);

  // The business logins this dealer has handed out; they can reset those
  // passwords on the owner's behalf.
  const [createdAccounts, setCreatedAccounts] = useState<AdminUser[]>([]);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsTotalPages, setAccountsTotalPages] = useState(1);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);

  function loadCreatedAccounts(page = accountsPage) {
    if (!isDealer) return;
    usersApi
      .created({ page })
      .then((r) => {
        setCreatedAccounts(r.data);
        setAccountsTotalPages(r.meta.totalPages);
      })
      .catch(() => undefined);
  }

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
    loadCreatedAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBusinessId) return;
    if (tab === "leads")
      leadsApi.listForBusiness(selectedBusinessId, { page: leadsPage }).then((r) => {
        setLeads(r.data);
        setLeadsTotalPages(r.meta.totalPages);
      });
    if (tab === "bookings")
      bookingsApi.forBusiness(selectedBusinessId, { page: bookingsPage }).then((r) => {
        setBookings(r.data);
        setBookingsTotalPages(r.meta.totalPages);
      });
  }, [tab, selectedBusinessId, leadsPage, bookingsPage]);

  // Switching business starts both lists from their first page.
  useEffect(() => {
    setLeadsPage(1);
    setBookingsPage(1);
  }, [selectedBusinessId]);

  useEffect(() => {
    loadCreatedAccounts(accountsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsPage]);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    setCreateError("");
    setOwnerCreds(null);
    const assignOwner = canAssignOwner && withOwner;
    try {
      const created = await businessesApi.create({
        ...newBusiness,
        latitude: Number(newBusiness.latitude),
        longitude: Number(newBusiness.longitude),
        country: "IN",
        ...(assignOwner
          ? {
              owner: {
                firstName: ownerAccount.firstName,
                lastName: ownerAccount.lastName,
                email: ownerAccount.email,
                phone: ownerAccount.phone || undefined,
                password: ownerAccount.password,
              },
            }
          : {}),
      });
      setNewBusiness({ name: "", slug: "", categoryId: "", phone: "", addressLine1: "", city: "", state: "", postalCode: "", latitude: "", longitude: "" });
      setShowCreate(false);
      loadBusinesses();
      if (assignOwner) {
        // The listing belongs to the business team's account now — surface
        // the login so the dealer can hand it over.
        setNotice("Business created, published, and assigned to the business team's account. Their login has also been emailed to them.");
        setOwnerCreds({
          businessName: created.name,
          username: created.ownerAccount?.email ?? ownerAccount.email,
          password: ownerAccount.password,
          created: created.ownerAccount?.created ?? true,
        });
        setOwnerAccount(emptyOwnerAccount);
        loadCreatedAccounts();
      } else {
        setNotice("Business created. Manage its details, hours, services, and photos below.");
        setManageId(created.id);
      }
    } catch (err) {
      // Shown inside the form, next to the submit button.
      setCreateError(apiErrorMessage(err));
    }
  }

  async function updateLead(leadId: string, status: string) {
    await leadsApi.updateStatus(leadId, status);
    if (selectedBusinessId) leadsApi.listForBusiness(selectedBusinessId, { page: leadsPage }).then((r) => setLeads(r.data));
  }

  async function updateBooking(bookingId: string, status: string) {
    await bookingsApi.updateStatus(bookingId, status);
    if (selectedBusinessId) bookingsApi.forBusiness(selectedBusinessId, { page: bookingsPage }).then((r) => setBookings(r.data));
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
        {visibleTabs.map((t) => {
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

      {visibleTabs.length === 0 && (
        <div className="card p-8 text-center text-sm text-ink-500">
          Your account doesn’t have any features enabled yet. Please contact your administrator to grant access.
        </div>
      )}

      {tab === "businesses" && canManageListings && manageId && (
        <BusinessManager
          businessId={manageId}
          categories={categories}
          onBack={() => setManageId(null)}
          onChanged={loadBusinesses}
        />
      )}

      {tab === "businesses" && canManageListings && !manageId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-900 flex items-center gap-1.5">
              <Building2 size={16} className="text-brand-600" /> Your listings
            </h2>
            <button
              onClick={() => {
                setShowCreate((v) => !v);
                setCreateError("");
              }}
              className={showCreate ? "btn-secondary px-3 py-2 text-sm" : "btn-primary px-3 py-2 text-sm"}
            >
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

          {ownerCreds && <OwnerCredsCard creds={ownerCreds} onDismiss={() => setOwnerCreds(null)} />}

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
              <input required minLength={7} maxLength={20} placeholder="Phone" value={newBusiness.phone} onChange={(e) => setNewBusiness({ ...newBusiness, phone: e.target.value })} className="input" />
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

              {canAssignOwner && (
                <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-brand-800 cursor-pointer">
                    <input type="checkbox" checked={withOwner} onChange={(e) => setWithOwner(e.target.checked)} />
                    <KeyRound size={14} /> Create a login for the business team
                  </label>
                  {withOwner ? (
                    <>
                      <p className="text-[11px] text-ink-500">
                        The listing is assigned to this account so the business can sign in and manage it. If the email
                        already has an account, the listing is linked to it and the password is ignored.
                      </p>
                      <div className="flex gap-3">
                        <input required className="input" placeholder="Contact first name" value={ownerAccount.firstName} onChange={(e) => setOwnerAccount({ ...ownerAccount, firstName: e.target.value })} />
                        <input required className="input" placeholder="Contact last name" value={ownerAccount.lastName} onChange={(e) => setOwnerAccount({ ...ownerAccount, lastName: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-600 mb-1">Login username (email)</label>
                        <input required type="email" className="input" placeholder="owner@business.com" value={ownerAccount.email} onChange={(e) => setOwnerAccount({ ...ownerAccount, email: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-600 mb-1">Login password (min 8 chars)</label>
                        <div className="flex gap-2">
                          <input required minLength={8} type="text" className="input font-mono" placeholder="Set a password" value={ownerAccount.password} onChange={(e) => setOwnerAccount({ ...ownerAccount, password: e.target.value })} />
                          <button type="button" onClick={() => setOwnerAccount({ ...ownerAccount, password: generatePassword() })} className="btn-secondary px-3 py-2 text-sm whitespace-nowrap">
                            <RefreshCw size={14} /> Generate
                          </button>
                        </div>
                      </div>
                      <input minLength={7} maxLength={20} className="input" placeholder="Contact phone (optional, min 7 digits)" value={ownerAccount.phone} onChange={(e) => setOwnerAccount({ ...ownerAccount, phone: e.target.value })} />
                    </>
                  ) : (
                    <p className="text-[11px] text-ink-500">The listing stays under your own account.</p>
                  )}
                </div>
              )}

              {createError && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{createError}</p>}
              <button className="btn-primary w-full py-2.5">Create listing</button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {businesses.slice((bizPage - 1) * 8, bizPage * 8).map((b) => (
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
          <Pagination page={bizPage} totalPages={Math.ceil(businesses.length / 8) || 1} onChange={setBizPage} />

          {isDealer && createdAccounts.length > 0 && (
            <div className="mt-8">
              <h2 className="font-bold text-ink-900 flex items-center gap-1.5 mb-1">
                <UsersRound size={16} className="text-brand-600" /> Business accounts you created
              </h2>
              <p className="text-xs text-ink-500 mb-3">
                Logins you handed out with a listing. If an owner forgets their password, reset it here and share the
                new one.
              </p>
              <div className="card divide-y divide-gray-100">
                {createdAccounts.map((a) => (
                  <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink-900 truncate">
                        {a.firstName} {a.lastName}
                      </p>
                      <p className="text-xs text-ink-500 truncate">{a.email}</p>
                      {a._count && (
                        <p className="text-[11px] text-ink-400 mt-0.5">
                          {a._count.businesses} {a._count.businesses === 1 ? "business" : "businesses"}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setResettingUser(a)} className="btn-secondary px-3 py-1.5 text-sm shrink-0 whitespace-nowrap">
                      <KeyRound size={14} /> Reset password
                    </button>
                  </div>
                ))}
              </div>
              <Pagination page={accountsPage} totalPages={accountsTotalPages} onChange={setAccountsPage} />
            </div>
          )}

          {resettingUser && <ResetPasswordModal user={resettingUser} onClose={() => setResettingUser(null)} />}
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
              <Pagination page={leadsPage} totalPages={leadsTotalPages} onChange={setLeadsPage} />
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
              <Pagination page={bookingsPage} totalPages={bookingsTotalPages} onChange={setBookingsPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
