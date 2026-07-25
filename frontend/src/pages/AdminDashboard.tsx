import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  type LucideIcon,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { adminApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { AdminUser, Business, Category, UserRole, UserStatus } from "@/types";
import Modal from "@/components/Modal";

const TABS = ["Overview", "Users", "Businesses", "Approvals"] as const;
type Tab = (typeof TABS)[number];

const ROLES: UserRole[] = ["CUSTOMER", "BUSINESS_OWNER", "DEALER", "ADMIN"];
const STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"];
const BIZ_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "SUSPENDED"];

function roleBadge(role: string): string {
  const map: Record<string, string> = {
    ADMIN: "bg-brand-50 text-brand-700",
    DEALER: "bg-violet-50 text-violet-700",
    BUSINESS_OWNER: "bg-sky-50 text-sky-700",
    CUSTOMER: "bg-gray-100 text-gray-600",
  };
  return map[role] ?? "bg-gray-100 text-gray-600";
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    PUBLISHED: "bg-emerald-50 text-emerald-700",
    SUSPENDED: "bg-red-50 text-red-700",
    PENDING_VERIFICATION: "bg-amber-50 text-amber-700",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700",
    DRAFT: "bg-gray-100 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

const STAT_META: { key: string; label: string; icon: LucideIcon; tint: string }[] = [
  { key: "userCount", label: "Users", icon: Users, tint: "bg-brand-50 text-brand-600" },
  { key: "dealerCount", label: "Dealers", icon: UserCog, tint: "bg-violet-50 text-violet-600" },
  { key: "businessCount", label: "Businesses", icon: Building2, tint: "bg-sky-50 text-sky-600" },
  { key: "publishedBusinessCount", label: "Published", icon: ShieldCheck, tint: "bg-emerald-50 text-emerald-600" },
  { key: "pendingBusinessCount", label: "Pending", icon: Calendar, tint: "bg-amber-50 text-amber-600" },
  { key: "reviewCount", label: "Reviews", icon: Star, tint: "bg-gold-50 text-gold-500" },
  { key: "leadCount", label: "Leads", icon: MessageSquare, tint: "bg-pink-50 text-pink-600" },
  { key: "openRfqCount", label: "Open RFQs", icon: Briefcase, tint: "bg-teal-50 text-teal-600" },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [stats, setStats] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.stats().then(setStats).catch((e) => setError(apiErrorMessage(e)));
    categoriesApi.list().then(setCategories).catch(() => undefined);
  }, []);

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-r from-ink-900 to-brand-800 px-6 py-6 sm:px-8 sm:py-7 mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Admin Console</h1>
        <p className="text-white/70 text-sm mt-1">Manage users, dealers, businesses, and platform data.</p>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t}
            {t === "Approvals" && (stats.pendingBusinessCount ?? 0) > 0 && (
              <span className="ml-1.5 badge bg-amber-100 text-amber-700 !px-1.5 !py-0">{stats.pendingBusinessCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAT_META.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="card p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tint}`}>
                  <Icon size={17} />
                </span>
                <p className="text-2xl font-extrabold text-ink-900 mt-3 leading-none">{stats[s.key] ?? 0}</p>
                <p className="text-xs text-ink-500 mt-1">{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "Users" && <UsersPanel onChanged={() => adminApi.stats().then(setStats)} />}
      {tab === "Businesses" && <BusinessesPanel categories={categories} onChanged={() => adminApi.stats().then(setStats)} />}
      {tab === "Approvals" && <ApprovalsPanel onChanged={() => adminApi.stats().then(setStats)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users panel
// ---------------------------------------------------------------------------

function UsersPanel({ onChanged }: { onChanged: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function load() {
    adminApi
      .users({ search: search || undefined, role: roleFilter || undefined })
      .then((r) => setUsers(r.data))
      .catch((e) => setError(apiErrorMessage(e)));
  }

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 flex-1">
          <Search size={16} className="text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="w-full py-2.5 text-sm focus:outline-none" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input sm:w-44">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <button onClick={() => setCreating(true)} className="btn-primary px-4 py-2.5 whitespace-nowrap">
          <UserPlus size={16} /> Add dealer
        </button>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="card divide-y divide-gray-100">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">
                {u.firstName[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-ink-900 truncate">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-xs text-ink-500 truncate">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`badge ${roleBadge(u.role)} hidden sm:inline-flex`}>{u.role.replace("_", " ")}</span>
              <span className={`badge ${statusBadge(u.status)} hidden md:inline-flex`}>{u.status.replace("_", " ")}</span>
              {u._count && u._count.businesses > 0 && <span className="text-xs text-ink-400 hidden lg:inline">{u._count.businesses} biz</span>}
              <button onClick={() => setEditing(u)} className="btn-secondary px-3 py-1.5 text-sm">
                Edit
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="p-8 text-center text-sm text-ink-500">No users found.</div>}
      </div>

      {editing && (
        <UserEditModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
      {creating && (
        <UserCreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function UserEditModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApi.updateUser(user.id, form);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${user.firstName} ${user.lastName}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" />
          <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" />
        </div>
        <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
        <div className="flex gap-3">
          <div className="w-1/2">
            <label className="block text-xs font-semibold text-ink-700 mb-1">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="w-1/2">
            <label className="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Modal>
  );
}

function UserCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "DEALER" as UserRole });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApi.createUser(form);
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add a user" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" />
          <input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" />
        </div>
        <input required className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
        <input required className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 8 chars)" />
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-500 mt-1">Dealers can add and manage stores on behalf of businesses.</p>
        </div>
        <button disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? "Creating…" : "Create user"}
        </button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Businesses panel
// ---------------------------------------------------------------------------

function BusinessesPanel({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Business | null>(null);
  const [reassigning, setReassigning] = useState<Business | null>(null);
  const [error, setError] = useState("");

  function load() {
    adminApi
      .businesses({ search: search || undefined, status: statusFilter || undefined })
      .then((r) => setBusinesses(r.data))
      .catch((e) => setError(apiErrorMessage(e)));
  }

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  async function quickAction(id: string, action: "approve" | "reject" | "suspend") {
    await adminApi[action](id);
    load();
    onChanged();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 flex-1">
          <Search size={16} className="text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or city…" className="w-full py-2.5 text-sm focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-52">
          <option value="">All statuses</option>
          {BIZ_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="space-y-2">
        {businesses.map((b) => (
          <div key={b.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-ink-900">{b.name}</p>
                  <span className={`badge ${statusBadge(b.status)}`}>{b.status.replace("_", " ")}</span>
                  {b.isVerified && (
                    <span className="badge bg-emerald-50 text-emerald-700">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500 mt-1">
                  {b.city}, {b.state} · {b.category?.name}
                </p>
                {b.owner && (
                  <p className="text-xs text-ink-500 mt-0.5">
                    Owner: {b.owner.firstName} {b.owner.lastName} ({b.owner.email}){" "}
                    <span className={`badge ${roleBadge(b.owner.role)} !px-1.5 !py-0`}>{b.owner.role.replace("_", " ")}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {b.status === "PENDING_APPROVAL" && (
                  <button onClick={() => quickAction(b.id, "approve")} className="btn-primary px-3 py-1.5 text-sm">
                    <Check size={14} /> Approve
                  </button>
                )}
                {b.status === "PUBLISHED" && (
                  <button onClick={() => quickAction(b.id, "suspend")} className="btn-secondary px-3 py-1.5 text-sm">
                    Suspend
                  </button>
                )}
                <button onClick={() => setReassigning(b)} className="btn-secondary px-3 py-1.5 text-sm">
                  Reassign
                </button>
                <button onClick={() => setEditing(b)} className="btn-secondary px-3 py-1.5 text-sm">
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
        {businesses.length === 0 && <div className="card p-8 text-center text-sm text-ink-500">No businesses found.</div>}
      </div>

      {editing && (
        <BusinessEditModal
          business={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
      {reassigning && (
        <ReassignModal
          business={reassigning}
          onClose={() => setReassigning(null)}
          onSaved={() => {
            setReassigning(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BusinessEditModal({
  business,
  categories,
  onClose,
  onSaved,
}: {
  business: Business;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: business.name,
    categoryId: business.category?.id ?? "",
    city: business.city,
    state: business.state,
    phone: business.phone,
    status: business.status,
    isVerified: !!business.isVerified,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApi.updateBusiness(business.id, form);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${business.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Business name" />
        <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
        </div>
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
        <div className="flex gap-3">
          <div className="w-1/2">
            <label className="block text-xs font-semibold text-ink-700 mb-1">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {BIZ_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <label className="w-1/2 flex items-end gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} />
            Verified business
          </label>
        </div>
        <button disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Modal>
  );
}

function ReassignModal({ business, onClose, onSaved }: { business: Business; onClose: () => void; onSaved: () => void }) {
  const [candidates, setCandidates] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      adminApi.users({ search: search || undefined }).then((r) =>
        setCandidates(r.data.filter((u) => u.role === "BUSINESS_OWNER" || u.role === "DEALER" || u.role === "ADMIN")),
      );
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const currentOwnerId = business.owner?.id;
  const list = useMemo(() => candidates.filter((u) => u.id !== currentOwnerId), [candidates, currentOwnerId]);

  async function reassign(userId: string) {
    setSavingId(userId);
    setError("");
    try {
      await adminApi.reassignBusiness(business.id, userId);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSavingId("");
    }
  }

  return (
    <Modal title={`Reassign “${business.name}”`} onClose={onClose}>
      <p className="text-sm text-ink-500 mb-3">
        Current owner:{" "}
        <span className="font-medium text-ink-800">
          {business.owner ? `${business.owner.firstName} ${business.owner.lastName}` : "—"}
        </span>
        . Choose a new owner (business owner, dealer, or admin).
      </p>
      {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-3">{error}</p>}
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 mb-3">
        <Search size={16} className="text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search owners/dealers…" className="w-full py-2.5 text-sm focus:outline-none" />
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
        {list.map((u) => (
          <div key={u.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate">
                {u.firstName} {u.lastName} <span className={`badge ${roleBadge(u.role)} !px-1.5 !py-0`}>{u.role.replace("_", " ")}</span>
              </p>
              <p className="text-xs text-ink-500 truncate">{u.email}</p>
            </div>
            <button disabled={!!savingId} onClick={() => reassign(u.id)} className="btn-primary px-3 py-1.5 text-sm shrink-0">
              {savingId === u.id ? "…" : "Assign"}
            </button>
          </div>
        ))}
        {list.length === 0 && <div className="p-6 text-center text-sm text-ink-500">No eligible owners found.</div>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Approvals panel
// ---------------------------------------------------------------------------

function ApprovalsPanel({ onChanged }: { onChanged: () => void }) {
  const [pending, setPending] = useState<Business[]>([]);

  function load() {
    adminApi.pendingBusinesses().then((r) => setPending(r.data));
  }
  useEffect(load, []);

  async function act(id: string, action: "approve" | "reject") {
    await adminApi[action](id);
    load();
    onChanged();
  }

  return (
    <div className="space-y-2">
      {pending.map((b) => (
        <div key={b.id} className="card p-4 flex justify-between items-center gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-ink-900">{b.name}</p>
            <p className="text-sm text-ink-500">
              {b.city}, {b.state}
              {b.owner ? ` · ${b.owner.email}` : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => act(b.id, "approve")} className="btn-primary text-sm px-3 py-1.5">
              <Check size={14} /> Approve
            </button>
            <button onClick={() => act(b.id, "reject")} className="btn-secondary text-sm px-3 py-1.5">
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      ))}
      {pending.length === 0 && <div className="card p-8 text-center text-sm text-ink-500">Nothing pending review.</div>}
    </div>
  );
}
