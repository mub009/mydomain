import { useEffect, useRef, useState } from "react";
import grapesjs, { type Editor } from "grapesjs";
import presetWebpage from "grapesjs-preset-webpage";
import "grapesjs/dist/css/grapes.min.css";
import { ExternalLink, Globe, RotateCcw, Save, Upload } from "lucide-react";
import { sitesApi, type SiteEditorPayload } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business } from "@/types";
import { Spinner } from "@/components/Loading";

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

  // Load the saved document (or the generated starter) before mounting.
  useEffect(() => {
    setLoading(true);
    sitesApi
      .get(business.id)
      .then((data) => {
        setPayload(data);
        setIsPublished(data.isPublished);
        setSavedAt(data.updatedAt);
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
      });
      setSavedAt(result.savedAt);
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
      setNotice(
        result.isPublished ? "Your website is live." : "Your website has been taken offline.",
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  // Discard edits and rebuild the page from the listing's current data.
  function resetToAccountData() {
    const editor = editorRef.current;
    if (!editor || !payload) return;
    if (!window.confirm("Replace the current design with a fresh page built from your business details?")) return;
    editor.setComponents(payload.starterHtml);
    editor.setStyle(payload.starterCss);
    setNotice("Rebuilt from your business details. Save to keep it.");
  }

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
              Drag blocks in to build your page. It starts from the details you entered for {business.name} — edit
              anything you like.
            </p>
            {savedAt && (
              <p className="mt-1 text-[11px] text-ink-400">Last saved {new Date(savedAt).toLocaleString()}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {isPublished ? "Live" : "Draft"}
            </span>
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

      {/* The builder itself */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div ref={holderRef} />
      </div>
    </div>
  );
}
