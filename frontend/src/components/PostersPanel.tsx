import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Plus, Search, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import {
  categoriesApi,
  PosterBandSuggestion,
  PosterCopySuggestion,
  PosterDesign,
  PosterPreviewBusiness,
  PosterSize,
  PosterStudioOptions,
  postersApi,
  RenderedPoster,
} from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Category } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { downloadPng, svgToDataUrl } from "@/lib/posterFile";

interface DesignForm {
  name: string;
  description: string;
  layout: string;
  palette: string;
  size: PosterSize;
  headline: string;
  subheadline: string;
  ctaText: string;
  badgeText: string;
  footnote: string;
  backgroundImageUrl: string;
  artworkUrl: string;
  headerText: string;
  footerText: string;
  showHeader: boolean;
  showFooter: boolean;
  logoPosition: string;
  logoScale: number;
  categoryId: string;
  city: string;
  isPublished: boolean;
  aiBrief: string;
  aiEngine: string;
}

const BLANK: DesignForm = {
  name: "",
  description: "",
  layout: "spotlight",
  palette: "crimson",
  size: "PORTRAIT",
  headline: "{{business}}, right here in {{city}}",
  subheadline: "Call {{phone}} or drop in — we're at {{address}}.",
  ctaText: "Call us today",
  badgeText: "",
  footnote: "",
  backgroundImageUrl: "",
  artworkUrl: "",
  headerText: "{{business}}",
  footerText: "{{address}}, {{city}}",
  showHeader: true,
  showFooter: true,
  logoPosition: "header",
  logoScale: 1,
  categoryId: "",
  city: "",
  isPublished: false,
  aiBrief: "",
  aiEngine: "",
};

function toForm(design: PosterDesign): DesignForm {
  return {
    name: design.name,
    description: design.description ?? "",
    layout: design.layout,
    palette: design.palette,
    size: design.size,
    headline: design.headline,
    subheadline: design.subheadline ?? "",
    ctaText: design.ctaText ?? "",
    badgeText: design.badgeText ?? "",
    footnote: design.footnote ?? "",
    backgroundImageUrl: design.backgroundImageUrl ?? "",
    artworkUrl: design.artworkUrl ?? "",
    headerText: design.headerText ?? "",
    footerText: design.footerText ?? "",
    showHeader: design.showHeader ?? true,
    showFooter: design.showFooter ?? true,
    logoPosition: design.logoPosition ?? "header",
    logoScale: design.logoScale ?? 1,
    categoryId: design.categoryId ?? "",
    city: design.city ?? "",
    isPublished: design.isPublished,
    aiBrief: design.aiBrief ?? "",
    aiEngine: design.aiEngine ?? "",
  };
}

/** Trims the form down to what the API accepts — empty strings become nulls. */
function toPayload(form: DesignForm) {
  const orNull = (value: string) => (value.trim() ? value.trim() : null);
  return {
    name: form.name.trim(),
    description: orNull(form.description),
    layout: form.layout,
    palette: form.palette,
    size: form.size,
    headline: form.headline.trim(),
    subheadline: orNull(form.subheadline),
    ctaText: orNull(form.ctaText),
    badgeText: orNull(form.badgeText),
    footnote: orNull(form.footnote),
    backgroundImageUrl: orNull(form.backgroundImageUrl),
    artworkUrl: orNull(form.artworkUrl),
    headerText: orNull(form.headerText),
    footerText: orNull(form.footerText),
    showHeader: form.showHeader,
    showFooter: form.showFooter,
    logoPosition: form.logoPosition,
    logoScale: form.logoScale,
    categoryId: form.categoryId || null,
    city: orNull(form.city),
    isPublished: form.isPublished,
    aiBrief: orNull(form.aiBrief),
    aiEngine: form.aiEngine || null,
  };
}

// ---------------------------------------------------------------------------

/** The brief, and the wording it comes back with. */
function AiWriter({
  options,
  category,
  city,
  onApply,
  onClose,
}: {
  options: PosterStudioOptions;
  category: string;
  city: string;
  onApply: (suggestion: PosterCopySuggestion, brief: string, engine: string) => void;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState({ occasion: "", tone: "warm", offer: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [engine, setEngine] = useState("");
  const [suggestions, setSuggestions] = useState<PosterCopySuggestion[]>([]);

  async function write() {
    setBusy(true);
    setError("");
    try {
      const result = await postersApi.aiSuggest({
        occasion: brief.occasion || undefined,
        tone: brief.tone,
        offer: brief.offer || undefined,
        notes: brief.notes || undefined,
        category: category || undefined,
        city: city || undefined,
        count: 3,
      });
      setSuggestions(result.suggestions);
      setEngine(result.engine);
      setNote(result.note ?? "");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const summary = [brief.occasion, brief.offer, brief.tone].filter(Boolean).join(", ");

  return (
    <Modal title="Write the poster wording" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-600">
        Say what the poster is for. The wording comes back with {"{{business}}"}-style placeholders already in it, so
        one design works for every shop.
        {options.ai.engine === "offline" && (
          <span className="mt-1 block text-xs text-ink-500">
            Using the built-in phrase bank. Set <code className="font-mono">POSTER_AI_PROVIDER=claude</code> and an API
            key for model-written copy.
          </span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">Occasion</label>
          <input
            className="input"
            placeholder="Diwali, monsoon sale, new branch…"
            value={brief.occasion}
            onChange={(e) => setBrief({ ...brief, occasion: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">Tone</label>
          <select className="input" value={brief.tone} onChange={(e) => setBrief({ ...brief, tone: e.target.value })}>
            {options.tones.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">Offer (optional)</label>
          <input
            className="input"
            placeholder="20% off, buy 1 get 1…"
            value={brief.offer}
            onChange={(e) => setBrief({ ...brief, offer: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">Anything else</label>
          <input
            className="input"
            placeholder="mention free home delivery"
            value={brief.notes}
            onChange={(e) => setBrief({ ...brief, notes: e.target.value })}
          />
        </div>
      </div>

      <button onClick={write} disabled={busy} className="btn-primary mt-3 w-full py-2.5">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? "Writing…" : suggestions.length ? "Write three more" : "Write three options"}
      </button>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {note && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{note}</p>}

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onApply(suggestion, summary, engine)}
              className="block w-full rounded-lg border border-gray-200 p-3 text-left hover:border-brand-500 hover:bg-brand-50/40"
            >
              <p className="font-bold text-ink-900">{suggestion.headline}</p>
              {suggestion.subheadline && <p className="mt-0.5 text-sm text-ink-600">{suggestion.subheadline}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestion.ctaText && <span className="badge bg-brand-50 text-brand-700">{suggestion.ctaText}</span>}
                {suggestion.badgeText && (
                  <span className="badge bg-amber-50 text-amber-800">{suggestion.badgeText}</span>
                )}
              </div>
            </button>
          ))}
          <p className="text-center text-xs text-ink-400">Click one to use it.</p>
        </div>
      )}
    </Modal>
  );
}


// ---------------------------------------------------------------------------

/**
 * For an uploaded design the platform adds only two strips and a logo, so the
 * brief is one free-text box rather than a form: describe the artwork and get
 * back the header line, the footer line and where the logo should sit.
 */
function BandWriter({
  options,
  onApply,
  onClose,
}: {
  options: PosterStudioOptions;
  onApply: (suggestion: PosterBandSuggestion, prompt: string, engine: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [engine, setEngine] = useState("");
  const [suggestions, setSuggestions] = useState<PosterBandSuggestion[]>([]);

  const spotLabel = (id: string) => options.logoPositions.find((p) => p.id === id)?.label ?? id;

  async function write() {
    setBusy(true);
    setError("");
    try {
      const result = await postersApi.aiBands(prompt);
      setSuggestions(result.suggestions);
      setEngine(result.engine);
      setNote(result.note ?? "");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Write the header, footer and logo placement" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-600">
        Describe the artwork and who it is for. You get back the two strips laid over it — with{" "}
        {"{{business}}"}-style placeholders, so one design serves every shop — and where the logo should sit.
        {options.ai.engine === "offline" && (
          <span className="mt-1 block text-xs text-ink-500">
            Using the built-in phrasings. Set <code className="font-mono">POSTER_AI_PROVIDER=claude</code> and an API
            key for model-written copy.
          </span>
        )}
      </p>

      <textarea
        className="input h-24 resize-none"
        placeholder="Diwali artwork, deep red and gold, lamps down the left side. Top-right corner is empty. For jewellery shops — keep it understated."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button onClick={write} disabled={busy || prompt.trim().length < 3} className="btn-primary mt-3 w-full py-2.5">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? "Writing…" : suggestions.length ? "Write three more" : "Write three options"}
      </button>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {note && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{note}</p>}

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onApply(suggestion, prompt, engine)}
              className="block w-full rounded-lg border border-gray-200 p-3 text-left hover:border-brand-500 hover:bg-brand-50/40"
            >
              <p className="font-bold text-ink-900">{suggestion.headerText}</p>
              {suggestion.footerText && <p className="mt-0.5 text-sm text-ink-600">{suggestion.footerText}</p>}
              <span className="badge mt-1.5 bg-violet-50 text-violet-700">
                Logo: {spotLabel(suggestion.logoPosition)}
              </span>
            </button>
          ))}
          <p className="text-center text-xs text-ink-400">Click one to use it.</p>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function DesignEditor({
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
  const [form, setForm] = useState<DesignForm>(existing ? toForm(existing) : BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [showBands, setShowBands] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [businesses, setBusinesses] = useState<PosterPreviewBusiness[]>([]);
  const [previewFor, setPreviewFor] = useState("");
  const [preview, setPreview] = useState<RenderedPoster | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [rendering, setRendering] = useState(false);

  const set = <K extends keyof DesignForm>(key: K, value: DesignForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const usingArtwork = form.layout === "artwork";

  // The file never reaches the design row as a file — the server validates the
  // bytes and hands back a data URI, which is what gets saved.
  async function uploadArtwork(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await postersApi.uploadArtwork(file);
      setForm((f) => ({ ...f, artworkUrl: result.dataUrl, layout: "artwork" }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // The list omits the uploaded artwork, so an edit has to fetch the design
  // in full or the first save would drop the image.
  useEffect(() => {
    if (!existing?.hasArtwork) return;
    postersApi
      .get(existing.id)
      .then((full) => setForm((f) => ({ ...f, artworkUrl: full.artworkUrl ?? "" })))
      .catch(() => undefined);
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

  // Re-render on every change, but only after the typing stops — the preview
  // hits a real listing, logo and all.
  const render = useCallback(() => {
    if (!form.headline.trim() || !form.name.trim()) return;
    setRendering(true);
    postersApi
      .preview({ ...toPayload(form), businessId: previewFor || undefined })
      .then((result) => {
        setPreview(result);
        setPreviewError("");
      })
      .catch((err) => setPreviewError(apiErrorMessage(err)))
      .finally(() => setRendering(false));
  }, [form, previewFor]);

  useEffect(() => {
    const id = setTimeout(render, 400);
    return () => clearTimeout(id);
  }, [render]);

  async function save(publish?: boolean) {
    setSaving(true);
    setError("");
    const payload = { ...toPayload(form), isPublished: publish ?? form.isPublished };
    try {
      if (existing) {
        await postersApi.update(existing.id, payload);
        onSaved(`“${form.name}” saved.`);
      } else {
        await postersApi.create(payload);
        onSaved(`“${form.name}” created.`);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  }

  // Which field the placeholder chips write into.
  const [target, setTarget] = useState<keyof DesignForm>("headline");
  const insert = (token: string) => set(target, `${(form[target] as string).trimEnd()} {{${token}}}`.trim());

  const selectedCategory = categories.find((c) => c.id === form.categoryId)?.name ?? "";

  return (
    <Modal title={existing ? "Edit poster design" : "New poster design"} onClose={onClose} wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Design name</label>
              <input
                className="input"
                placeholder="Onam greeting 2026"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Size</label>
              <select className="input" value={form.size} onChange={(e) => set("size", e.target.value as PosterSize)}>
                {options.sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label} — {size.hint}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Layout</label>
            <div className="grid grid-cols-2 gap-2">
              {options.layouts.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => set("layout", layout.id)}
                  className={`rounded-lg border p-2.5 text-left text-sm ${
                    form.layout === layout.id ? "border-brand-600 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="font-semibold text-ink-900">{layout.name}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{layout.bestFor}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Colours</label>
            <div className="flex flex-wrap gap-2">
              {options.palettes.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  title={palette.name}
                  onClick={() => set("palette", palette.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${
                    form.palette === palette.id ? "border-brand-600 ring-1 ring-brand-500" : "border-gray-200"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: palette.bg }} />
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: palette.accent }} />
                  {palette.name}
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-lg border border-gray-200 p-3 ${usingArtwork ? "opacity-50" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-700">
                Wording{usingArtwork && <span className="ml-1 font-normal text-ink-400">— not used by uploaded artwork</span>}
              </p>
              <button type="button" onClick={() => setShowAi(true)} className="btn-secondary px-3 py-1.5 text-xs">
                <Wand2 size={13} /> Write it for me
              </button>
            </div>

            <div className="space-y-2">
              {(
                [
                  ["headline", "Headline", "Happy Onam from {{business}}"],
                  ["subheadline", "Subheadline", "Call {{phone}} or drop in — we're at {{address}}."],
                  ["ctaText", "Button text", "Call us today"],
                  ["badgeText", "Corner flash", "20% OFF"],
                  ["footnote", "Footnote", "{{business}} · {{city}}"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-600">{label}</label>
                  <input
                    className="input"
                    placeholder={placeholder}
                    value={form[key]}
                    onFocus={() => setTarget(key)}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-500">Insert:</span>
              {options.placeholders.map((placeholder) => (
                <button
                  key={placeholder.token}
                  type="button"
                  title={`${placeholder.label} — e.g. ${placeholder.example}`}
                  onClick={() => insert(placeholder.token)}
                  className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  {placeholder.token}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Only for category</label>
              <select className="input" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Every category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Only for city</label>
              <input
                className="input"
                placeholder="Every city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-700">Designer's artwork</p>
              {form.artworkUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, artworkUrl: "", layout: "spotlight" }))}
                  className="text-xs text-red-700 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {form.artworkUrl ? (
              <img
                src={form.artworkUrl}
                alt="Uploaded artwork"
                className="max-h-40 w-full rounded-md border border-gray-200 object-contain"
              />
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-6 text-sm text-ink-500 hover:border-brand-500 hover:text-brand-700">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "Uploading…" : "Upload a finished poster (PNG, JPEG, WebP)"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => uploadArtwork(e.target.files?.[0])}
                />
              </label>
            )}
            <p className="mt-1.5 text-[11px] leading-snug text-ink-500">
              Upload a design made elsewhere and the platform adds only the header, footer and logo — everything else
              is left exactly as drawn. Up to {Math.round(options.maxArtworkBytes / 1024 / 1024)}MB.
            </p>
          </div>

          {usingArtwork && (
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-700">What goes over the artwork</p>
                <button type="button" onClick={() => setShowBands(true)} className="btn-secondary px-3 py-1.5 text-xs">
                  <Wand2 size={13} /> Write it for me
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-ink-600">Header line</label>
                    <label className="flex items-center gap-1 text-[11px] text-ink-500">
                      <input
                        type="checkbox"
                        checked={form.showHeader}
                        onChange={(e) => set("showHeader", e.target.checked)}
                      />
                      show
                    </label>
                  </div>
                  <input
                    className="input"
                    placeholder="{{business}}"
                    value={form.headerText}
                    onFocus={() => setTarget("headerText")}
                    onChange={(e) => set("headerText", e.target.value)}
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-ink-600">Footer line (above the number)</label>
                    <label className="flex items-center gap-1 text-[11px] text-ink-500">
                      <input
                        type="checkbox"
                        checked={form.showFooter}
                        onChange={(e) => set("showFooter", e.target.checked)}
                      />
                      show
                    </label>
                  </div>
                  <input
                    className="input"
                    placeholder="{{address}}, {{city}}"
                    value={form.footerText}
                    onFocus={() => setTarget("footerText")}
                    onChange={(e) => set("footerText", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-600">Logo position</label>
                    <select
                      className="input"
                      value={form.logoPosition}
                      onChange={(e) => set("logoPosition", e.target.value)}
                    >
                      {options.logoPositions.map((spot) => (
                        <option key={spot.id} value={spot.id}>
                          {spot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-600">
                      Logo size ({form.logoScale.toFixed(1)}×)
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      className="w-full"
                      value={form.logoScale}
                      onChange={(e) => set("logoScale", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Background image URL (optional)</label>
            <input
              className="input"
              placeholder="https://…"
              value={form.backgroundImageUrl}
              onChange={(e) => set("backgroundImageUrl", e.target.value)}
            />
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button disabled={saving} onClick={() => save()} className="btn-secondary flex-1 py-2.5">
              {saving ? "Saving…" : "Save as draft"}
            </button>
            <button disabled={saving} onClick={() => save(true)} className="btn-primary flex-1 py-2.5">
              {saving ? "Saving…" : "Save & publish"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-700">Preview for</label>
          <select className="input mb-2" value={previewFor} onChange={(e) => setPreviewFor(e.target.value)}>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name} — {business.city}
              </option>
            ))}
          </select>

          <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {preview ? (
              <img src={svgToDataUrl(preview.svg)} alt="Poster preview" className="w-full" />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-ink-400">
                <ImageIcon size={18} className="mr-2" /> Name it and write a headline
              </div>
            )}
            {rendering && (
              <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow">
                <Loader2 size={14} className="animate-spin text-brand-600" />
              </div>
            )}
          </div>

          {previewError && <p className="mt-2 text-xs text-red-700">{previewError}</p>}
          {preview && !preview.logoEmbedded && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              This shop's logo could not be loaded, so the poster shows its initials instead.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-ink-500">
            This is the real listing — its own logo, name and number. Every shop gets the same design filled with theirs.
          </p>
        </div>
      </div>

      {showBands && (
        <BandWriter
          options={options}
          onClose={() => setShowBands(false)}
          onApply={(suggestion, prompt, engine) => {
            setForm((f) => ({
              ...f,
              headerText: suggestion.headerText,
              footerText: suggestion.footerText,
              logoPosition: suggestion.logoPosition,
              aiBrief: prompt,
              aiEngine: engine,
            }));
            setShowBands(false);
          }}
        />
      )}

      {showAi && (
        <AiWriter
          options={options}
          category={selectedCategory}
          city={form.city}
          onClose={() => setShowAi(false)}
          onApply={(suggestion, brief, engine) => {
            setForm((f) => ({
              ...f,
              headline: suggestion.headline,
              subheadline: suggestion.subheadline,
              ctaText: suggestion.ctaText,
              badgeText: suggestion.badgeText,
              footnote: suggestion.footnote || f.footnote,
              aiBrief: brief,
              aiEngine: engine,
            }));
            setShowAi(false);
          }}
        />
      )}
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

  const layoutNames = useMemo(
    () => Object.fromEntries((options?.layouts ?? []).map((l) => [l.id, l.name])),
    [options],
  );

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
      setNotice(`“${design.name}” ${design.isPublished ? "unpublished" : "published to matching shops"}.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(design: PosterDesign) {
    if (!window.confirm(`Delete “${design.name}”? Shops will no longer see it.`)) return;
    try {
      await postersApi.remove(design.id);
      setNotice(`“${design.name}” deleted.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function downloadSample(design: PosterDesign) {
    try {
      const rendered = await postersApi.preview({
        name: design.name,
        layout: design.layout,
        palette: design.palette,
        size: design.size,
        headline: design.headline,
        subheadline: design.subheadline,
        ctaText: design.ctaText,
        badgeText: design.badgeText,
        footnote: design.footnote,
        backgroundImageUrl: design.backgroundImageUrl,
        headerText: design.headerText,
        footerText: design.footerText,
        showHeader: design.showHeader,
        showFooter: design.showFooter,
        logoPosition: design.logoPosition,
        logoScale: design.logoScale,
        // Fetched rather than taken from the list, which omits it.
        artworkUrl: design.hasArtwork ? (await postersApi.get(design.id)).artworkUrl : null,
      });
      await downloadPng(rendered.svg, rendered.width, rendered.height, rendered.fileName);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designs…"
            className="w-full py-2.5 text-sm focus:outline-none"
          />
        </div>
        <select
          value={publishedFilter}
          onChange={(e) => setPublishedFilter(e.target.value)}
          className="input sm:w-44"
        >
          <option value="">All designs</option>
          <option value="true">Published</option>
          <option value="false">Drafts</option>
        </select>
        <button
          onClick={() => setCreating(true)}
          disabled={!options}
          className="btn-primary whitespace-nowrap px-4 py-2.5"
        >
          <Plus size={16} /> New design
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
                  <span className="badge bg-brand-50 text-brand-700">
                    {layoutNames[design.layout] ?? design.layout} · {design.size.toLowerCase()}
                  </span>
                  {design.hasArtwork && <span className="badge bg-amber-50 text-amber-800">uploaded artwork</span>}
                  {design.aiEngine && <span className="badge bg-violet-50 text-violet-700">written by {design.aiEngine}</span>}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-600">
                  {design.hasArtwork ? design.headerText || design.name : design.headline}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {design.category?.name ?? "All categories"} · {design.city ?? "All cities"}
                  {design.businessesUsing ? ` · ${design.businessesUsing} shops, ${design.downloads} downloads` : ""}
                </p>
                {design.warnings?.map((warning) => (
                  <p key={warning} className="mt-1 text-[11px] text-amber-700">
                    {warning}
                  </p>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => downloadSample(design)} className="btn-secondary px-3 py-1.5 text-sm">
                  <Download size={14} /> Sample
                </button>
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
              No poster designs yet. Create one — every shop will get it with their own logo and number.
            </div>
          )}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {options && (creating || editing) && (
        <DesignEditor
          options={options}
          categories={categories}
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(message) => {
            setNotice(message);
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
