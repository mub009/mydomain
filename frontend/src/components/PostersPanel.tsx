import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, QrCode, Search, Trash2, Upload } from "lucide-react";
import {
  categoriesApi,
  PosterDesign,
  PosterPreviewBusiness,
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

const CORNER_LABELS: Record<string, string> = {
  "top-left": "in the top left",
  "top-right": "in the top right",
  "bottom-left": "in the bottom left",
  "bottom-right": "in the bottom right",
  center: "in the centre",
};

/**
 * Mirrors the server's `qrCornerFromPrompt` so the editor can say where the
 * code will land as the prompt is typed. The clause containing the token is
 * what describes it — see the server for why proximity alone is not enough.
 */
function readQrCorner(prompt: string): string {
  const corners: [RegExp, string][] = [
    [/\b(?:top|upper)[\s-]*left\b/i, "top-left"],
    [/\b(?:top|upper)[\s-]*right\b/i, "top-right"],
    [/\b(?:bottom|lower)[\s-]*left\b/i, "bottom-left"],
    [/\b(?:bottom|lower)[\s-]*right\b/i, "bottom-right"],
    [/\b(?:cent(?:re|er)|middle)\b/i, "center"],
  ];
  const firstIn = (text: string) => {
    let best: [number, string] | null = null;
    for (const [pattern, corner] of corners) {
      const at = text.search(pattern);
      if (at >= 0 && (!best || at < best[0])) best = [at, corner];
    }
    return best?.[1] ?? null;
  };

  const clause = prompt.split(/[,;.\n]/).find((part) => /(?<![\w@])@qr(?![\w])/i.test(part));
  return (clause && firstIn(clause)) || firstIn(prompt) || "bottom-right";
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
  // What the last upload turned out to be: an SVG template's slots, and
  // anything the sanitiser took out of it.
  const [uploaded, setUpload] = useState<{
    slots: string[];
    unknownSlots: string[];
    removed: string[];
    isTemplate: boolean;
  } | null>(null);

  const [businesses, setBusinesses] = useState<PosterPreviewBusiness[]>([]);
  const [previewFor, setPreviewFor] = useState("");
  const [resolved, setResolved] = useState<{ resolved: string; unknown: string[] } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    postersApi
      .previewBusinesses()
      .then((rows) => {
        setBusinesses(rows);
        setPreviewFor((current) => current || rows[0]?.id || "");
      })
      .catch(() => setBusinesses([]));
  }, []);

  // Show the prompt as one real shop would receive it, so the tokens can be
  // seen resolving before the poster is saved.
  useEffect(() => {
    if (!form.aiPrompt.trim()) {
      setResolved(null);
      return;
    }
    const id = setTimeout(() => {
      postersApi
        .resolvePrompt(form.aiPrompt, previewFor || undefined)
        .then((result) => setResolved({ resolved: result.resolved, unknown: result.unknown }))
        .catch(() => setResolved(null));
    }, 400);
    return () => clearTimeout(id);
  }, [form.aiPrompt, previewFor]);

  /** Drops a token in at the cursor rather than always at the end. */
  function insertToken(token: string) {
    const field = promptRef.current;
    const snippet = `@${token}`;
    if (!field) {
      patch({ aiPrompt: `${form.aiPrompt} ${snippet}`.trim() });
      return;
    }
    const { selectionStart, selectionEnd, value } = field;
    const next = `${value.slice(0, selectionStart)}${snippet}${value.slice(selectionEnd)}`;
    patch({ aiPrompt: next });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(selectionStart + snippet.length, selectionStart + snippet.length);
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await postersApi.uploadArtwork(file);
      patch({ artworkUrl: result.dataUrl });
      setUpload({
        slots: result.slots ?? [],
        unknownSlots: result.unknownSlots ?? [],
        removed: result.removed ?? [],
        isTemplate: result.type === "image/svg+xml",
      });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // Mirrors the server's `promptWantsQr`: an @qr or {{qr}} token, but not
  // "@qrcode", and not the "@" in an email address.
  const wantsQr = /(?<![\w@])@qr(?![\w])/i.test(form.aiPrompt) || /\{\{\s*qr\s*\}\}/i.test(form.aiPrompt);
  const qrCorner = readQrCorner(form.aiPrompt);

  const missing = [!form.name.trim() && "a design name", !form.artworkUrl && "the image file"].filter(
    Boolean,
  ) as string[];

  // How many listings this poster will actually reach. A category that reads
  // right in the design's name is not always the one its shops are filed
  // under, and without this the mistake only shows up as an empty Posters tab
  // in someone else's dashboard.
  const reach = form.categoryId ? (options.reach.byCategory[form.categoryId] ?? 0) : options.reach.all;

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
              <option value="">All categories — every business</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <p className={`mt-1 text-[11px] ${reach === 0 ? "font-semibold text-red-700" : "text-ink-500"}`}>
              {reach === 0
                ? "No businesses are filed under this category, so nobody will see this poster."
                : `${reach} ${reach === 1 ? "business" : "businesses"} will see this in Manage → Posters.`}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">AI prompt</label>
            <textarea
              ref={promptRef}
              className="input h-28 resize-none"
              placeholder="Diwali poster for @business_name, a @category in @city. Deep red and gold, diyas along the bottom. Show the phone number @phone."
              value={form.aiPrompt}
              onChange={(e) => patch({ aiPrompt: e.target.value })}
            />

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-500">Insert business data:</span>
              {options.placeholders.map((placeholder) => (
                <button
                  key={placeholder.token}
                  type="button"
                  title={`${placeholder.label} — e.g. ${placeholder.example}`}
                  onClick={() => insertToken(placeholder.token)}
                  className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  @{placeholder.token}
                </button>
              ))}
            </div>

            <p className="mt-1.5 text-[11px] leading-snug text-ink-500">
              Write it once with <span className="font-mono">@tokens</span> and each business's own details are filled
              in when the image is made. The prompt is kept with the poster for reference and for regenerating it later.
            </p>

            {form.aiPrompt.trim() && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-ink-600">Filled in for</span>
                  <select
                    className="max-w-[60%] truncate rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px]"
                    value={previewFor}
                    onChange={(e) => setPreviewFor(e.target.value)}
                  >
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name} — {business.city}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="whitespace-pre-wrap text-xs leading-snug text-ink-700">
                  {resolved?.resolved ?? "…"}
                </p>
                {resolved?.unknown.length ? (
                  <p className="mt-1.5 text-[11px] text-amber-700">
                    Nothing will fill {resolved.unknown.map((t) => `@${t}`).join(", ")} — it stays as written.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Nothing to set: the prompt decides both whether there is a QR and
              where it goes. This just reports what it read. */}
          {wantsQr && (
            <p className="flex items-start gap-1.5 rounded-md bg-sky-50 px-3 py-2 text-[11px] leading-snug text-sky-900">
              <QrCode size={13} className="mt-px shrink-0" />
              <span>
                Each shop gets a QR to its own Markkito page, {CORNER_LABELS[qrCorner] ?? qrCorner}. Say where in the
                prompt — "leave the top right clear for <span className="font-mono">@qr</span>" — or drop the token to
                remove it.
              </span>
            </p>
          )}

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
                SVG, PNG, JPEG, WebP or GIF · up to {Math.round(options.maxArtworkBytes / 1024 / 1024)}MB
              </span>
              <span className="text-[11px] text-brand-700">
                SVG fills the designer's own slots exactly
              </span>
              <input
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
          )}

          {/* An SVG template says what it will fill. Finding out now that a
              slot was mistyped is the difference between fixing one file and
              recalling a poster from a hundred shops. */}
          {uploaded?.isTemplate && (
            <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-[11px]">
              {uploaded.slots.length > 0 ? (
                <>
                  <p className="font-semibold text-brand-800">
                    Template with {uploaded.slots.length} slot{uploaded.slots.length === 1 ? "" : "s"} — filled per shop:
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {uploaded.slots.map((slot) => (
                      <span key={slot} className="rounded-full bg-white px-2 py-0.5 font-mono text-brand-700">
                        @{slot}
                      </span>
                    ))}
                  </p>
                </>
              ) : (
                <p className="font-semibold text-amber-800">
                  No slots found. Mark them in the artwork as text — @CLINIC_NAME@, @PHONE@, @ADDRESS@, @LOGO@,
                  @QR_CODE@ — and re-upload, or this prints the same for every shop.
                </p>
              )}
              {/* Nothing fills these, so they are wiped off the poster rather
                  than printed. This is the only place they can be caught. */}
              {uploaded.unknownSlots.length > 0 && (
                <p className="mt-1.5 font-semibold text-red-700">
                  Nothing fills{" "}
                  <span className="font-mono">{uploaded.unknownSlots.map((slot) => `@${slot}@`).join(", ")}</span> —
                  these will be left blank. Rename them in the artwork to one of the slots above.
                </p>
              )}
              {uploaded.removed.length > 0 && (
                <p className="mt-1.5 text-ink-600">
                  Stripped on upload: <span className="font-mono">{uploaded.removed.join(", ")}</span>
                </p>
              )}
            </div>
          )}

          {/* A flat image has no slots to find, so the shop's details can only
              go on in strips over the top. Worth saying before a hundred
              posters go out looking like that. */}
          {uploaded && !uploaded.isTemplate && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800">
              A flat image has no slots to fill, so this prints as your artwork with the shop's logo and QR placed on
              it — no name, no phone number, and nothing laid over the design. For those to appear{" "}
              <span className="font-semibold">inside</span> the artwork, ask the designer for the same file as{" "}
              <span className="font-semibold">SVG</span>.
            </p>
          )}

          {form.artworkUrl && (
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-200 py-1.5 text-xs text-ink-600 hover:border-brand-500 hover:text-brand-700">
              <Upload size={13} /> Replace image
              <input
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
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
                  {design.showQr && (
                    <span className="badge bg-sky-50 text-sky-700">
                      QR {design.qrCorner ? (CORNER_LABELS[design.qrCorner] ?? "").replace("in the ", "") : ""}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {design.category?.name ?? "All categories"}
                  {" · "}
                  <span className={design.reach === 0 ? "font-semibold text-red-700" : ""}>
                    reaches {design.reach ?? 0}
                  </span>
                  {design.businessesUsing ? ` · ${design.businessesUsing} made it, ${design.downloads} downloads` : ""}
                </p>
                {/* Published but nobody can see it is the failure this whole
                    row exists to catch, so it gets said in words. */}
                {design.isPublished && design.reach === 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-red-700">
                    Published, but no business is filed under this category — nobody can see it.
                  </p>
                )}
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
