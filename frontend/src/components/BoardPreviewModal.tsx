import { useEffect, useState } from "react";
import { Check, Copy, Download, Printer } from "lucide-react";
import Modal from "@/components/Modal";
import { Spinner } from "@/components/Loading";
import { ReviewChannel } from "@/types";
import { boardHeadline, boardUrl, downloadDataUrl, renderQrDataUrl } from "@/lib/qrBoard";

// Full-size, printable view of one issued board: its QR, the code beneath it
// (so it can be typed if a camera struggles), and download/print actions.
export default function BoardPreviewModal({
  code,
  businessName,
  channel,
  onClose,
}: {
  code: string;
  businessName: string;
  channel?: ReviewChannel | null;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const target = boardUrl(code);

  useEffect(() => {
    renderQrDataUrl(target)
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [target]);

  function copyLink() {
    navigator.clipboard?.writeText(target).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  }

  return (
    <Modal title={`QR board ${code}`} onClose={onClose}>
      {/* The printable board — print styles isolate #qr-board on the page. */}
      <div id="qr-board" className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
        <h4 className="mt-1 text-xl font-extrabold text-ink-900">{businessName}</h4>
        <p className="mt-0.5 text-sm text-ink-500">{boardHeadline(channel)}</p>
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code ${code}`} className="mx-auto mt-3 h-52 w-52" />
        ) : (
          <div className="mx-auto mt-3 flex h-52 w-52 items-center justify-center">
            <Spinner label="" />
          </div>
        )}
        <p className="mt-2 font-mono text-sm font-bold text-ink-900">{code}</p>
        <p className="mt-0.5 text-xs text-ink-400">Point your camera at the code</p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
      </div>

      <p className="mt-2 break-all text-[11px] text-ink-400">{target}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dataUrl}
          onClick={() => downloadDataUrl(dataUrl, `${code}-qr.png`)}
          className="btn-primary flex-1 py-2.5 disabled:opacity-50"
        >
          <Download size={15} /> Download PNG
        </button>
        <button type="button" onClick={() => window.print()} className="btn-secondary flex-1 py-2.5">
          <Printer size={15} /> Print
        </button>
        <button type="button" onClick={copyLink} className="btn-secondary flex-1 py-2.5">
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </Modal>
  );
}
