import { useEffect, useMemo, useRef, useState } from "react";
import grapesjs, { type Editor } from "grapesjs";
import presetWebpage from "grapesjs-preset-webpage";
import "grapesjs/dist/css/grapes.min.css";
import { Check, ExternalLink, Eye, Globe, LayoutTemplate, RotateCcw, Save, Upload, X } from "lucide-react";
import { sitesApi, type SiteEditorPayload, type SiteTemplateChoice } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business } from "@/types";
import { Spinner } from "@/components/Loading";

interface Draft {
  templateId: string;
  html: string;
  css: string;
}

// A template rendered into a standalone document, so the preview frame shows
// exactly what a visitor would see. Sandboxed with no same-origin access —
// scripts are allowed only so the embedded Google map works.
function previewDocument(draft: Draft): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box}
body{margin:0}
#mk-site-root{display:block;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;line-height:1.5;background:#fff}
#mk-site-root img{max-width:100%}
${draft.css}
</style></head><body><div id="mk-site-root">${draft.html}</div></body></html>`;
}

// Drag-and-drop website builder for a single business. The first draft is
// generated server-side from the data the owner already entered in their
// listing; from then on their saved document is the source of truth.
export default function SiteBuilder({ business }: { business: Business }) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [payload, setPayload] = useState<SiteEditorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Template state. `draft` is whatever design the editor was last seeded
  // from — it also backs the Reset button, so resetting keeps the design the
  // owner chose rather than snapping back to the default.
  const [templates, setTemplates] = useState<SiteTemplateChoice[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Draft | null>(null);
  const [busyTemplate, setBusyTemplate] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load the saved document (or the generated starter) before mounting.
  useEffect(() => {
    setLoading(true);
    sitesApi
      .get(business.id)
      .then((data) => {
        setPayload(data);
        setIsPublished(data.isPublished);
        setSavedAt(data.updatedAt);
        setTemplates(data.templates);
        setTemplateId(data.templateId);
        setDraft({ templateId: data.renderedTemplateId, html: data.starterHtml, css: data.starterCss });
        // A shop that has never saved has nothing to lose, so show the choices
        // up front; an existing site keeps the picker tucked away.
        setPickerOpen(!data.hasSavedDraft);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [business.id]);

  // Mount GrapesJS once the payload is in hand.
  useEffect(() => {
    if (!payload || !holderRef.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: holderRef.current,
      height: "70vh",
      width: "auto",
      // We persist explicitly via the Save button, not on every keystroke.
      storageManager: false,
      plugins: [presetWebpage],
      pluginsOpts: {
        [presetWebpage as unknown as string]: { modalImportTitle: "Import HTML" },
      },
      assetManager: {
        // Offer the shop's own photos as ready-to-drop assets. File uploads
        // are off — images are added by URL, same as elsewhere in the app.
        assets: (business.photos ?? []).map((photo) => photo.url),
        upload: false,
      },
      deviceManager: {
        devices: [
          { id: "desktop", name: "Desktop", width: "" },
          { id: "tablet", name: "Tablet", width: "768px", widthMedia: "992px" },
          { id: "mobile", name: "Mobile", width: "375px", widthMedia: "575px" },
        ],
      },
    });

    if (payload.projectData) {
      editor.loadProjectData(payload.projectData as object);
    } else {
      // First visit: seed from the starter built out of their account data.
      editor.setComponents(payload.starterHtml);
      editor.setStyle(payload.starterCss);
    }

    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [payload, business.photos]);

  // Close the preview on Escape, the way any modal should behave.
  useEffect(() => {
    if (!preview) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  async function save(): Promise<boolean> {
    const editor = editorRef.current;
    if (!editor) return false;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await sitesApi.save(business.id, {
        projectData: editor.getProjectData(),
        html: editor.getHtml(),
        css: editor.getCss(),
        templateId: templateId || undefined,
      });
      setSavedAt(result.savedAt);
      setTemplateId(result.templateId);
      setNotice("Website saved.");
      return true;
    } catch (err) {
      setError(apiErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    // Publishing an unsaved editor would push stale HTML, so save first.
    if (!isPublished && !(await save())) return;

    setPublishing(true);
    setError("");
    try {
      const result = await sitesApi.publish(business.id, !isPublished);
      setIsPublished(result.isPublished);
      setNotice(result.isPublished ? "Your website is live." : "Your website has been taken offline.");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  // Fetch a design rendered with this business's own data and show it full
  // size before anything is changed.
  async function openPreview(choice: SiteTemplateChoice) {
    setBusyTemplate(choice.id);
    setError("");
    try {
      setPreview(await sitesApi.previewTemplate(business.id, choice.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyTemplate("");
    }
  }

  // Swap the editor over to a design. This replaces the page, so anything the
  // owner has customised is lost — hence the confirmation.
  async function applyTemplate(choice: SiteTemplateChoice, rendered?: Draft) {
    const editor = editorRef.current;
    if (!editor) return;
    if (
      !window.confirm(
        `Rebuild your page with the "${choice.name}" design? Any changes you made in the builder will be replaced.`,
      )
    ) {
      return;
    }

    setBusyTemplate(choice.id);
    setError("");
    setNotice("");
    try {
      const next = rendered ?? (await sitesApi.previewTemplate(business.id, choice.id));
      editor.setComponents(next.html);
      editor.setStyle(next.css);
      setDraft(next);
      setTemplateId(next.templateId);
      setPreview(null);
      setNotice(`Switched to the ${choice.name} design. Save to keep it.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyTemplate("");
    }
  }

  // Discard edits and rebuild the page from the listing's current data, using
  // the design that is currently selected.
  function resetToAccountData() {
    const editor = editorRef.current;
    if (!editor || !draft) return;
    if (!window.confirm("Replace the current design with a fresh page built from your business details?")) return;
    editor.setComponents(draft.html);
    editor.setStyle(draft.css);
    setNotice("Rebuilt from your business details. Save to keep it.");
  }

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );
  const previewChoice = useMemo(
    () => templates.find((t) => t.id === preview?.templateId) ?? null,
    [templates, preview],
  );

  if (loading) return <Spinner label="Opening the website builder…" />;
  if (error && !payload) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;

  const publicUrl = `${window.location.origin}/site/${business.slug}`;

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
              <Globe size={16} className="text-brand-600" /> Your website
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Pick a design, then drag blocks in to make it yours. It starts from the details you entered for{" "}
              {business.name}.
            </p>
            {savedAt && <p className="mt-1 text-[11px] text-ink-400">Last saved {new Date(savedAt).toLocaleString()}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {isPublished ? "Live" : "Draft"}
            </span>
            <button onClick={() => setPickerOpen((open) => !open)} className="btn-secondary px-3 py-2 text-sm">
              <LayoutTemplate size={14} /> {activeTemplate ? activeTemplate.name : "Designs"}
            </button>
            <button onClick={resetToAccountData} className="btn-secondary px-3 py-2 text-sm">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={save} disabled={saving} className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">
              <Save size={14} /> {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`px-3 py-2 text-sm ${isPublished ? "btn-secondary" : "btn-primary"} disabled:opacity-50`}
            >
              <Upload size={14} /> {publishing ? "Working…" : isPublished ? "Unpublish" : "Publish"}
            </button>
          </div>
        </div>

        {notice && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {isPublished && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
          >
            <ExternalLink size={14} /> {publicUrl}
          </a>
        )}
      </div>

      {/* Design picker */}
      {pickerOpen && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-ink-900">Choose a design</h4>
              <p className="mt-0.5 text-xs text-ink-500">
                Every design is filled in with your own photos, services, hours and contact details. Preview one before
                you switch — applying it replaces what is in the builder.
              </p>
            </div>
            <button
              onClick={() => setPickerOpen(false)}
              className="rounded-md p-1.5 text-ink-400 hover:bg-gray-100 hover:text-ink-700"
              aria-label="Hide designs"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((choice) => {
              const active = choice.id === templateId;
              const busy = busyTemplate === choice.id;
              return (
                <div
                  key={choice.id}
                  className={`flex flex-col overflow-hidden rounded-lg border ${
                    active ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
                  }`}
                >
                  {/* A colour band standing in for the design's look. */}
                  <div className="h-14" style={{ background: choice.accent }} />
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-ink-900">{choice.name}</span>
                      {active && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                          <Check size={10} /> In use
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{choice.description}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-ink-400">Good for: {choice.bestFor}</p>
                    <div className="mt-3 flex gap-2 pt-1">
                      <button
                        onClick={() => openPreview(choice)}
                        disabled={busy}
                        className="btn-secondary flex-1 px-2 py-1.5 text-xs disabled:opacity-50"
                      >
                        <Eye size={13} /> Preview
                      </button>
                      <button
                        onClick={() => applyTemplate(choice)}
                        disabled={busy || active}
                        className="btn-primary flex-1 px-2 py-1.5 text-xs disabled:opacity-40"
                      >
                        {busy ? "…" : active ? "Applied" : "Use"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* The builder itself */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div ref={holderRef} />
      </div>

      {/* Full-page preview of a design, rendered with this business's data. */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-6 w-6 flex-none rounded-full"
                  style={{ background: previewChoice?.accent ?? "#999" }}
                />
                <div>
                  <p className="text-sm font-bold text-ink-900">{previewChoice?.name ?? "Preview"}</p>
                  <p className="text-[11px] text-ink-500">Previewing with {business.name}'s own content</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewChoice && previewChoice.id !== templateId && (
                  <button
                    onClick={() => applyTemplate(previewChoice, preview)}
                    disabled={busyTemplate === previewChoice.id}
                    className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <Check size={14} /> Use this design
                  </button>
                )}
                <button onClick={() => setPreview(null)} className="btn-secondary px-3 py-2 text-sm">
                  <X size={14} /> Close
                </button>
              </div>
            </div>
            <iframe
              title="Website preview"
              className="h-full w-full flex-1 border-0 bg-white"
              // No same-origin: the frame cannot reach back into the app.
              // Scripts stay on only so the embedded Google map renders.
              sandbox="allow-scripts allow-popups"
              srcDoc={previewDocument(preview)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
