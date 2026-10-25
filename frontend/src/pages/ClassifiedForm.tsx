import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { classifiedCategoriesApi, classifiedsApi, uploadsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedCategory } from "@/types";
import { useAuthStore } from "@/store/authStore";
import LocationInput from "@/components/LocationInput";
import { Spinner } from "@/components/Loading";

const MAX_PHOTOS = 10;

const EMPTY_FORM = {
  title: "",
  description: "",
  categoryId: "",
  condition: "USED" as "NEW" | "USED",
  price: "",
  city: "",
  state: "",
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  contactPhone: "",
  whatsappEnabled: false,
  whatsappNumber: "",
};

export default function ClassifiedForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    classifiedCategoriesApi.list().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    classifiedsApi
      .get(id)
      .then((l) => {
        if (user && l.sellerId !== user.id && user.role !== "ADMIN") {
          navigate("/my-listings", { replace: true });
          return;
        }
        setForm({
          title: l.title,
          description: l.description ?? "",
          categoryId: l.categoryId,
          condition: l.condition,
          price: String(l.priceCents / 100),
          city: l.city,
          state: l.state ?? "",
          latitude: l.latitude ?? undefined,
          longitude: l.longitude ?? undefined,
          contactPhone: l.contactPhone,
          whatsappEnabled: l.whatsappEnabled,
          whatsappNumber: l.whatsappNumber ?? "",
        });
        setPhotos((l.photos ?? []).map((p) => p.url));
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate, user]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const toUpload = Array.from(files).slice(0, Math.max(0, room));
      const urls = await Promise.all(toUpload.map((f) => uploadsApi.image(f, "classifieds")));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (photos.length === 0) {
      setError("Add at least one photo.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        categoryId: form.categoryId,
        condition: form.condition,
        priceCents: Math.round(Number(form.price || 0) * 100),
        city: form.city,
        state: form.state || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
        contactPhone: form.contactPhone,
        whatsappEnabled: form.whatsappEnabled,
        whatsappNumber: form.whatsappEnabled ? form.whatsappNumber || form.contactPhone : undefined,
        photos,
      };
      const saved = isEdit && id ? await classifiedsApi.update(id, payload) : await classifiedsApi.create(payload);
      navigate(`/classifieds/${saved.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading listing…" />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-extrabold text-ink-900">{isEdit ? "Edit listing" : "Sell an item"}</h1>
      <p className="mt-1 text-sm text-ink-500">
        {isEdit ? "Update your listing's details." : "Post a used or new item for local buyers to find."}
      </p>

      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-700">Photos ({photos.length}/{MAX_PHOTOS})</label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {photos.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Remove photo"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-ink-400 hover:border-brand-400 hover:text-brand-600"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                <span className="text-[10px] font-semibold">{uploading ? "Uploading" : "Add"}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-400">
            <Upload size={11} /> First photo is used as the cover image.
          </p>
        </div>

        <input required placeholder="Title (e.g. iPhone 15 Pro 256GB)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />

        <select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input">
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, condition: "USED" })}
            className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
              form.condition === "USED" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 text-ink-600 hover:bg-gray-50"
            }`}
          >
            Used
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, condition: "NEW" })}
            className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
              form.condition === "NEW" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 text-ink-600 hover:bg-gray-50"
            }`}
          >
            New
          </button>
        </div>

        <input
          required
          type="number"
          min={0}
          placeholder="Price (₹)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="input"
        />

        <textarea
          placeholder="Description — condition, reason for selling, anything a buyer should know"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input min-h-[100px]"
        />

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-700">Location</label>
          <LocationInput
            value={form.city}
            onChange={(city) => setForm({ ...form, city })}
            onDetect={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
          />
        </div>
        <input placeholder="State (optional)" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input" />

        <input
          required
          minLength={7}
          maxLength={20}
          placeholder="Contact phone"
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          className="input"
        />

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={form.whatsappEnabled}
            onChange={(e) => setForm({ ...form, whatsappEnabled: e.target.checked })}
          />
          Buyers can also reach me on WhatsApp
        </label>
        {form.whatsappEnabled && (
          <input
            minLength={7}
            maxLength={20}
            placeholder={`WhatsApp number (defaults to ${form.contactPhone || "contact phone"})`}
            value={form.whatsappNumber}
            onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
            className="input"
          />
        )}

        <button disabled={saving} className="btn-primary w-full py-2.5">
          {saving ? "Saving…" : isEdit ? "Save changes" : "Post listing"}
        </button>
      </form>
    </div>
  );
}
