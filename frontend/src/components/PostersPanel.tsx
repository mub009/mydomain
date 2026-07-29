import { useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import {
  categoriesApi,
  PosterDesign,
  PosterStudioOptions,
  postersApi,
} from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Category } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";

/**
 * Poster Studio — admin side.
 *
 * A poster is an image file, filed under a category, with the prompt it came
 * from kept alongside it. That is the whole of it. The platform's own
 * rendering — the bands, the logo, the per-business details — is a later step
 * and deliberately not a decision the admin has to make while cataloguing
 * artwork.
 */

interface PosterForm {
  name: string;
  categoryId: string;
  artworkUrl: string;
  aiPrompt: string;
  isPublished: boolean;
}

const BLANK: PosterForm = {
  name: "",
  categoryId: "",
  artworkUrl: "",
  aiPrompt: "",
  isPublished: false,
};

function toForm(design: PosterDesign): PosterForm {
  return {
    name: design.name,
    categoryId: design.categoryId ?? "",
    artworkUrl: design.artworkUrl ?? "",
    aiPrompt: design.aiPrompt ?? "",
    isPublished: design.isPublished,
  };
}

// ---------------------------------------------------------------------------

function PosterEditor({
  options,
  categories,
  existing,
  onClose,
  onSaved,
}: {
  options: PosterStudioOptions;
  categories: Category[];
  existing: PosterDesign | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<PosterForm>(existing ? toForm(existing) : BLANK);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const patch = (values: Partial<PosterForm>) => setForm((f) => ({ ...f, ...values }));

  // The list omits the uploaded file, so editing has to fetch the poster in
  // full or the first save would drop the artwork.
  useEffect(() => {
    if (!existing?.hasArtwork) return;
    postersApi
      .get(existing.id)
      .then((full) => patch({ artworkUrl: full.artworkUrl ?? "" }))
      .catch(() => setError("The artwork on file could not be loaded — re-upload before saving."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await postersApi.uploadArtwork(file);
      patch({ artworkUrl: result.dataUrl });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const missing = [
    !form.name.trim() && "a design name",
    !form.categoryId && "a category",
    !form.artworkUrl && "the image file",
  ].filter(Boolean) as string[];

  async function save(publish?: boolean) {
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      artworkUrl: form.artworkUrl || null,
      aiPrompt: form.aiPrompt.trim() || null,
      isPublished: publish ?? form.isPublished,
    };

    try {
      if (existing) {
        await postersApi.update(existing.id, payload);
        onSaved(`“${payload.name}” saved.`);
      } else {
        await postersApi.create(payload);
        onSaved(`“${payload.name}” added.`);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={existing ? "Edit poster" : "New poster"} onClose={onClose} wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Design name</label>
            <input
              className="input"
              placeholder="Diwali 2026 — jewellery"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Category</label>
            <select className="input" value={form.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
              <option value="">Choose a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">AI prompt</label>
            <textarea
              className="input h-28 resize-none"
              placeholder="Diwali poster for jewellery shops — deep red and gold, diyas along the bottom, space kept clear top-right for a logo."
              value={form.aiPrompt}
              onChange={(e) => patch({ aiPrompt: e.target.value })}
            />
            <p className="mt-1 text-[11px] leading-snug text-ink-500">
              The prompt this design came from. Kept with the poster so it can be looked up later, or used as the
              starting point when the design is regenerated.
            </p>
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {missing.length > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Still needs {missing.join(", ")}.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              disabled={saving || missing.length > 0}
              onClick={() => save()}
              className="btn-secondary flex-1 py-2.5"
            >
              {saving ? "Saving…" : "Save as draft"}
            </button>
            <button
              disabled={saving || missing.length > 0}
              onClick={() => save(true)}
              className="btn-primary flex-1 py-2.5"
            >
              {saving ? "Saving…" : "Save & publish"}
            </button>
          </div>
        </div>

        {/* Artwork */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-ink-700">Image file</label>
            {form.artworkUrl && (
              <button type="button" onClick={() => patch({ artworkUrl: "" })} className="text-xs text-red-700 hover:underline">
                Remove
              </button>
            )}
          </div>

          {form.artworkUrl ? (
            <img
              src={form.artworkUrl}
              alt="Uploaded design"
              className="w-full rounded-lg border border-gray-200 object-contain"
            />
          ) : (
            <label className="flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 text-center text-sm text-ink-500 hover:border-brand-500 hover:text-brand-700">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? "Uploading…" : "Upload the image"}
              <span className="text-[11px] text-ink-400">
                PNG, JPEG, WebP or GIF · up to {Math.round(options.maxArtworkBytes / 1024 / 1024)}MB
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
          )}

          {form.artworkUrl && (
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-200 py-1.5 text-xs text-ink-600 hover:border-brand-500 hover:text-brand-700">
              <Upload size={13} /> Replace image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export default function PostersPanel() {
  const [options, setOptions] = useState<PosterStudioOptions | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [designs, setDesigns] = useState<PosterDesign[]>([]);
  const [search, setSearch] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<PosterDesign | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    postersApi
      .list({ search: search || undefined, published: publishedFilter || undefined, page })
      .then((r) => {
        setDesigns(r.data);
        setTotalPages(r.meta.totalPages);
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    postersApi.options().then(setOptions).catch(() => setOptions(null));
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, publishedFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, publishedFilter]);

  async function togglePublished(design: PosterDesign) {
    try {
      await postersApi.update(design.id, { isPublished: !design.isPublished });
      setNotice(`“${design.name}” ${design.isPublished ? "unpublished" : "published"}.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(design: PosterDesign) {
    if (!window.confirm(`Delete “${design.name}”?`)) return;
    try {
      await postersApi.remove(design.id);
      setNotice(`“${design.name}” deleted.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posters…"
            className="w-full py-2.5 text-sm focus:outline-none"
          />
        </div>
        <select value={publishedFilter} onChange={(e) => setPublishedFilter(e.target.value)} className="input sm:w-44">
          <option value="">All posters</option>
          <option value="true">Published</option>
          <option value="false">Drafts</option>
        </select>
        <button
          onClick={() => setCreating(true)}
          disabled={!options}
          className="btn-primary whitespace-nowrap px-4 py-2.5"
        >
          <Plus size={16} /> New poster
        </button>
      </div>

      {notice && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && <ListSkeleton rows={4} />}

      {!loading && (
        <div className="card divide-y divide-gray-100">
          {designs.map((design) => (
            <div key={design.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink-900">{design.name}</p>
                  <span
                    className={`badge ${design.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {design.isPublished ? "published" : "draft"}
                  </span>
                  {!design.hasArtwork && <span className="badge bg-amber-50 text-amber-800">no artwork</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {design.category?.name ?? "No category"}
                  {design.businessesUsing ? ` · ${design.businessesUsing} shops, ${design.downloads} downloads` : ""}
                </p>
                {design.aiPrompt && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-600" title={design.aiPrompt}>
                    <span className="font-semibold text-ink-500">Prompt: </span>
                    {design.aiPrompt}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setEditing(design)} className="btn-secondary px-3 py-1.5 text-sm">
                  Edit
                </button>
                <button onClick={() => togglePublished(design)} className="btn-secondary px-3 py-1.5 text-sm">
                  {design.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => remove(design)} className="btn-secondary px-3 py-1.5 text-sm text-red-700">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {designs.length === 0 && (
            <div className="p-8 text-center text-sm text-ink-500">
              <ImageIcon size={20} className="mx-auto mb-2 text-ink-300" />
              No posters yet. Add one — name it, file it under a category and upload the image.
            </div>
          )}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {options && (creating || editing) && (
        <PosterEditor
          options={options}
          categories={categories}
          existing={editing}
          onClose={close}
          onSaved={(message) => {
            setNotice(message);
            close();
            load();
          }}
        />
      )}
    </div>
  );
}
