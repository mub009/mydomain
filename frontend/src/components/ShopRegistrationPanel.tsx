import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, IndianRupee, Store, User, Wallet } from "lucide-react";
import { registrationsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Category, RegistrationPaymentMethod, ShopRegistration } from "@/types";

const PAYMENT_METHODS: { value: RegistrationPaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMoney(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  ownerFirstName: "",
  ownerLastName: "",
  ownerEmail: "",
  ownerPhone: "",
  ownerPassword: "",
  name: "",
  slug: "",
  slugTouched: false,
  categoryId: "",
  description: "",
  phone: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  latitude: "",
  longitude: "",
  amount: "",
  paymentMethod: "CASH" as RegistrationPaymentMethod,
  notes: "",
};

export default function ShopRegistrationPanel({ categories }: { categories: Category[] }) {
  const [form, setForm] = useState(emptyForm);
  const [registrations, setRegistrations] = useState<ShopRegistration[]>([]);
  const [summary, setSummary] = useState({ totalCollectedCents: 0, collectedCount: 0 });
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    registrationsApi
      .mine()
      .then((r) => {
        setRegistrations(r.data);
        setSummary(r.summary);
      })
      .catch(() => undefined);
  }

  useEffect(load, []);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const effectiveSlug = useMemo(
    () => (form.slugTouched ? form.slug : slugify(form.name)),
    [form.slug, form.slugTouched, form.name],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await registrationsApi.register({
        owner: {
          firstName: form.ownerFirstName,
          lastName: form.ownerLastName,
          email: form.ownerEmail,
          phone: form.ownerPhone || undefined,
          password: form.ownerPassword,
        },
        business: {
          name: form.name,
          slug: effectiveSlug,
          categoryId: form.categoryId,
          description: form.description || undefined,
          phone: form.phone,
          addressLine1: form.addressLine1,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          country: "IN",
        },
        payment: {
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          notes: form.notes || undefined,
        },
      });
      const reused = res.ownerReused;
      setNotice({
        kind: "ok",
        text: `Shop registered and ${formatMoney(res.registration.amountCents)} recorded as collected. ${
          reused
            ? "Linked to the owner's existing account."
            : "A new owner account was created — share the login email and password with them."
        } The listing is now pending admin approval.`,
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setNotice({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Collections summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 sm:col-span-2 bg-gradient-to-r from-emerald-600 to-brand-600 text-white">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Wallet size={16} /> Total collected
          </div>
          <p className="text-3xl font-extrabold mt-1">{formatMoney(summary.totalCollectedCents)}</p>
          <p className="text-white/70 text-xs mt-1">Registration fees you have collected across all shops.</p>
        </div>
        <div className="card p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Store size={17} />
          </span>
          <p className="text-2xl font-extrabold text-ink-900 mt-3 leading-none">{summary.collectedCount}</p>
          <p className="text-xs text-ink-500 mt-1">Shops registered</p>
        </div>
      </div>

      {notice && (
        <p
          className={`text-sm rounded-md px-3 py-2 ${
            notice.kind === "ok" ? "text-emerald-800 bg-emerald-50" : "text-red-700 bg-red-50"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Registration form */}
      <form onSubmit={submit} className="card p-5 space-y-5">
        <div>
          <h3 className="font-bold text-ink-900 flex items-center gap-1.5">
            <Store size={16} className="text-brand-600" /> Register a new shop
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Capture the owner's details, the shop's details, and the fee you collected. The listing goes to admin for
            approval.
          </p>
        </div>

        {/* Owner details */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5 mb-1">
            <User size={13} /> Owner details
          </legend>
          <div className="flex gap-3">
            <input required className="input" placeholder="First name" value={form.ownerFirstName} onChange={(e) => set({ ownerFirstName: e.target.value })} />
            <input required className="input" placeholder="Last name" value={form.ownerLastName} onChange={(e) => set({ ownerLastName: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <input required type="email" className="input" placeholder="Owner email" value={form.ownerEmail} onChange={(e) => set({ ownerEmail: e.target.value })} />
            <input className="input" placeholder="Owner phone (optional)" value={form.ownerPhone} onChange={(e) => set({ ownerPhone: e.target.value })} />
          </div>
          <input required type="password" className="input" placeholder="Set a login password (min 8 chars)" value={form.ownerPassword} onChange={(e) => set({ ownerPassword: e.target.value })} />
          <p className="text-xs text-ink-400 -mt-1">If the email already has an account, the shop is linked to it and this password is ignored.</p>
        </fieldset>

        {/* Business details */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5 mb-1">
            <Store size={13} /> Shop details
          </legend>
          <input required className="input" placeholder="Shop name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          <input required className="input" placeholder="URL slug" value={effectiveSlug} onChange={(e) => set({ slug: e.target.value, slugTouched: true })} />
          <select required className="input" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input required className="input" placeholder="Shop phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          <input required className="input" placeholder="Address line 1" value={form.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} />
          <div className="flex gap-3">
            <input required className="input w-1/2" placeholder="City" value={form.city} onChange={(e) => set({ city: e.target.value })} />
            <input required className="input w-1/2" placeholder="State" value={form.state} onChange={(e) => set({ state: e.target.value })} />
          </div>
          <input required className="input" placeholder="Postal code" value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
          <div className="flex gap-3">
            <input required className="input w-1/2" placeholder="Latitude" value={form.latitude} onChange={(e) => set({ latitude: e.target.value })} />
            <input required className="input w-1/2" placeholder="Longitude" value={form.longitude} onChange={(e) => set({ longitude: e.target.value })} />
          </div>
        </fieldset>

        {/* Fee */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5 mb-1">
            <IndianRupee size={13} /> Registration fee collected
          </legend>
          <div className="flex gap-3">
            <div className="relative w-1/2">
              <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input required type="number" min="1" step="0.01" className="input pl-8" placeholder="Amount" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            </div>
            <select className="input w-1/2" value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value as RegistrationPaymentMethod })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <input className="input" placeholder="Payment note (optional, e.g. receipt no.)" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </fieldset>

        <button disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? "Registering…" : "Register shop & record payment"}
        </button>
      </form>

      {/* Past registrations */}
      <div>
        <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-1.5">
          <BadgeCheck size={16} className="text-brand-600" /> Your registrations
        </h3>
        <div className="card divide-y divide-gray-100">
          {registrations.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-ink-900 truncate">{r.business?.name}</p>
                <p className="text-xs text-ink-500 truncate">
                  {r.owner?.firstName} {r.owner?.lastName} · {r.owner?.email}
                </p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {r.business?.city}, {r.business?.state} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-emerald-700">{formatMoney(r.amountCents, r.currency)}</p>
                <span className="badge bg-gray-100 text-gray-600 mt-1">{r.paymentMethod.replace("_", " ")}</span>
              </div>
            </div>
          ))}
          {registrations.length === 0 && (
            <div className="p-8 text-center text-sm text-ink-500">No registrations yet — register your first shop above.</div>
          )}
        </div>
      </div>
    </div>
  );
}
