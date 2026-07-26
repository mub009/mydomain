import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  ImagePlus,
  Info,
  Plus,
  Send,
  Trash2,
  Wrench,
} from "lucide-react";
import { businessesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category } from "@/types";
import ReviewQrBoard from "@/components/ReviewQrBoard";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SECTIONS = ["Details", "Hours", "Services", "Photos", "Reviews & QR"] as const;
type Section = (typeof SECTIONS)[number];

interface HourRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

function defaultHours(existing: Business["hours"]): HourRow[] {
  return Array.from({ length: 7 }, (_, day) => {
    const found = existing?.find((h) => h.dayOfWeek === day);
    return found
      ? { dayOfWeek: day, openTime: found.openTime, closeTime: found.closeTime, isClosed: found.isClosed }
      : { dayOfWeek: day, openTime: "09:00", closeTime: "18:00", isClosed: day === 0 };
  });
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700",
    DRAFT: "bg-gray-100 text-gray-600",
    SUSPENDED: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export default function BusinessManager({
  businessId,
  categories,
  onBack,
  onChanged,
}: {
  businessId: string;
  categories: Category[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const [biz, setBiz] = useState<Business | null>(null);
  const [section, setSection] = useState<Section>("Details");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [details, setDetails] = useState({
    name: "",
    description: "",
    categoryId: "",
    phone: "",
    email: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: "",
    longitude: "",
  });
  const [hours, setHours] = useState<HourRow[]>([]);
  const [newService, setNewService] = useState({ name: "", description: "", price: "", durationMins: "60" });
  const [newPhoto, setNewPhoto] = useState({ url: "", caption: "" });

  function hydrate(b: Business) {
    setBiz(b);
    setDetails({
      name: b.name,
      description: b.description ?? "",
      categoryId: b.category?.id ?? "",
      phone: b.phone,
      email: b.email ?? "",
      website: b.website ?? "",
      addressLine1: b.addressLine1 ?? "",
      addressLine2: b.addressLine2 ?? "",
      city: b.city,
      state: b.state,
      postalCode: b.postalCode ?? "",
      latitude: String(b.latitude),
      longitude: String(b.longitude),
    });
    setHours(defaultHours(b.hours));
  }

  function load() {
    businessesApi
      .manage(businessId)
      .then(hydrate)
      .catch((err) => setError(apiErrorMessage(err)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  function flash(msg: string) {
    setNotice(msg);
    setError("");
    setTimeout(() => setNotice(""), 2500);
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await businessesApi.update(businessId, {
        ...details,
        latitude: Number(details.latitude),
        longitude: Number(details.longitude),
        email: details.email || undefined,
        website: details.website || undefined,
        addressLine2: details.addressLine2 || undefined,
      });
      flash("Details saved.");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveHours() {
    setSaving(true);
    setError("");
    try {
      await businessesApi.setHours(businessId, hours);
      flash("Opening hours saved.");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await businessesApi.addService(businessId, {
        name: newService.name,
        description: newService.description || undefined,
        priceCents: Math.round(Number(newService.price || 0) * 100),
        durationMins: Number(newService.durationMins),
      });
      setNewService({ name: "", description: "", price: "", durationMins: "60" });
      flash("Service added.");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function toggleService(serviceId: string, isActive: boolean) {
    await businessesApi.updateService(businessId, serviceId, { isActive });
    load();
  }

  async function removeService(serviceId: string) {
    await businessesApi.deleteService(businessId, serviceId);
    flash("Service removed.");
    load();
  }

  async function addPhoto(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await businessesApi.addPhoto(businessId, { url: newPhoto.url, caption: newPhoto.caption || undefined });
      setNewPhoto({ url: "", caption: "" });
      flash("Photo added.");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removePhoto(photoId: string) {
    await businessesApi.removePhoto(businessId, photoId);
    load();
  }

  async function submitForApproval() {
    await businessesApi.submitForApproval(businessId);
    flash("Submitted for approval.");
    load();
    onChanged();
  }

  if (error && !biz) return <p className="text-red-600">{error}</p>;
  if (!biz) return <div className="h-40 rounded-xl bg-gray-200 animate-pulse" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-secondary px-3 py-2 text-sm">
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-ink-900">{biz.name}</h2>
            <span className={`badge ${statusBadge(biz.status)}`}>{biz.status.replace("_", " ")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {biz.status === "PUBLISHED" && (
            <Link to={`/business/${biz.slug}`} className="btn-secondary px-3 py-2 text-sm">
              <ExternalLink size={15} /> View public page
            </Link>
          )}
          {biz.status !== "PUBLISHED" && biz.status !== "PENDING_APPROVAL" && (
            <button onClick={submitForApproval} className="btn-primary px-3 py-2 text-sm">
              <Send size={15} /> Submit for approval
            </button>
          )}
        </div>
      </div>

      {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">{notice}</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              section === s ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Details */}
      {section === "Details" && (
        <form onSubmit={saveDetails} className="card p-5 space-y-3">
          <h3 className="font-bold text-ink-900 flex items-center gap-1.5">
            <Info size={16} className="text-brand-600" /> Business details
          </h3>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Business name</label>
            <input required value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Description</label>
            <textarea
              value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })}
              className="input min-h-24"
              placeholder="Tell customers about your business"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Category</label>
              <select required value={details.categoryId} onChange={(e) => setDetails({ ...details, categoryId: e.target.value })} className="input">
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Phone</label>
              <input required value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Email</label>
              <input type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Website</label>
              <input value={details.website} onChange={(e) => setDetails({ ...details, website: e.target.value })} className="input" placeholder="https://…" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Address line 1</label>
            <input required value={details.addressLine1} onChange={(e) => setDetails({ ...details, addressLine1: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Address line 2</label>
            <input value={details.addressLine2} onChange={(e) => setDetails({ ...details, addressLine2: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">City</label>
              <input required value={details.city} onChange={(e) => setDetails({ ...details, city: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">State</label>
              <input required value={details.state} onChange={(e) => setDetails({ ...details, state: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Postal code</label>
              <input required value={details.postalCode} onChange={(e) => setDetails({ ...details, postalCode: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Latitude</label>
              <input required value={details.latitude} onChange={(e) => setDetails({ ...details, latitude: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Longitude</label>
              <input required value={details.longitude} onChange={(e) => setDetails({ ...details, longitude: e.target.value })} className="input" />
            </div>
          </div>
          <button disabled={saving} className="btn-primary px-5 py-2.5">
            {saving ? "Saving…" : "Save details"}
          </button>
        </form>
      )}

      {/* Hours */}
      {section === "Hours" && (
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-ink-900 flex items-center gap-1.5">
            <Clock size={16} className="text-brand-600" /> Opening hours
          </h3>
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={h.dayOfWeek} className="flex items-center gap-3 flex-wrap">
                <span className="w-24 text-sm font-medium text-ink-800">{DAY_NAMES[h.dayOfWeek]}</span>
                <label className="flex items-center gap-1.5 text-sm text-ink-600">
                  <input
                    type="checkbox"
                    checked={h.isClosed}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, isClosed: e.target.checked };
                      setHours(next);
                    }}
                  />
                  Closed
                </label>
                {!h.isClosed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.openTime}
                      onChange={(e) => {
                        const next = [...hours];
                        next[i] = { ...h, openTime: e.target.value };
                        setHours(next);
                      }}
                      className="input !w-32 !py-1.5"
                    />
                    <span className="text-ink-400">–</span>
                    <input
                      type="time"
                      value={h.closeTime}
                      onChange={(e) => {
                        const next = [...hours];
                        next[i] = { ...h, closeTime: e.target.value };
                        setHours(next);
                      }}
                      className="input !w-32 !py-1.5"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button disabled={saving} onClick={saveHours} className="btn-primary px-5 py-2.5">
            {saving ? "Saving…" : "Save hours"}
          </button>
        </div>
      )}

      {/* Services */}
      {section === "Services" && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-1.5">
              <Wrench size={16} className="text-brand-600" /> Services
            </h3>
            <div className="space-y-2">
              {(biz.services ?? []).map((s) => (
                <div key={s.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-ink-900">
                      {s.name} {!s.isActive && <span className="text-xs text-ink-400">(hidden)</span>}
                    </p>
                    <p className="text-xs text-ink-500">
                      {s.priceCents > 0 ? `${s.currency} ${(s.priceCents / 100).toFixed(2)}` : "Free"} · {s.durationMins} mins
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleService(s.id, !s.isActive)}
                      className="text-xs font-medium rounded-md border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50"
                    >
                      {s.isActive ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => removeService(s.id)} className="text-red-500 hover:text-red-600 p-1.5" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {(biz.services ?? []).length === 0 && <p className="text-sm text-ink-500">No services yet.</p>}
            </div>
          </div>

          <form onSubmit={addService} className="card p-5 space-y-3">
            <h3 className="font-bold text-ink-900 flex items-center gap-1.5">
              <Plus size={16} className="text-brand-600" /> Add a service
            </h3>
            <input required placeholder="Service name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="input" />
            <input placeholder="Description (optional)" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} className="input" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Price (INR)</label>
                <input type="number" min={0} step="0.01" placeholder="0.00" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Duration (mins)</label>
                <input type="number" min={5} value={newService.durationMins} onChange={(e) => setNewService({ ...newService, durationMins: e.target.value })} className="input" />
              </div>
            </div>
            <button className="btn-primary px-5 py-2.5">Add service</button>
          </form>
        </div>
      )}

      {/* Photos */}
      {section === "Photos" && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-1.5">
              <ImagePlus size={16} className="text-brand-600" /> Photos
            </h3>
            {(biz.photos ?? []).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(biz.photos ?? []).map((p) => (
                  <div key={p.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                    <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removePhoto(p.id)}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-red-500 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">No photos yet.</p>
            )}
          </div>

          <form onSubmit={addPhoto} className="card p-5 space-y-3">
            <h3 className="font-bold text-ink-900 flex items-center gap-1.5">
              <Plus size={16} className="text-brand-600" /> Add a photo
            </h3>
            <input required type="url" placeholder="Image URL (https://…)" value={newPhoto.url} onChange={(e) => setNewPhoto({ ...newPhoto, url: e.target.value })} className="input" />
            <input placeholder="Caption (optional)" value={newPhoto.caption} onChange={(e) => setNewPhoto({ ...newPhoto, caption: e.target.value })} className="input" />
            <button className="btn-primary px-5 py-2.5">Add photo</button>
          </form>
        </div>
      )}

      {section === "Reviews & QR" && <ReviewQrBoard business={biz} />}
    </div>
  );
}
