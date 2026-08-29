import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { uploadsApi, UploadPurpose } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  purpose: UploadPurpose;
  label?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
}

// A URL field with an "Upload" button next to it: pick a file, it's sent to
// DigitalOcean Spaces via the shared /uploads/image endpoint, and the
// returned CDN URL is dropped straight into the same field the URL text
// input writes to — the rest of the form (save, preview) doesn't change.
export default function ImageUploadField({
  value,
  onChange,
  purpose,
  label,
  hint,
  placeholder,
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      onChange(await uploadsApi.image(file, purpose));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      // Cleared so picking the same file again still fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      {label && <label className="mb-1 block text-xs font-semibold text-ink-700">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1"
          placeholder={placeholder ?? "https://… or upload a file"}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="btn-secondary shrink-0 px-3 py-2 text-sm"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
