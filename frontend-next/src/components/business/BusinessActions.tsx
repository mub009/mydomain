"use client";

import { useState } from "react";
import { Copy, MessageSquare, Phone, Share2 } from "lucide-react";

export function PhoneReveal({ phone, variant = "primary" }: { phone: string; variant?: "primary" | "link" }) {
  const [shown, setShown] = useState(false);
  if (variant === "link") {
    return (
      <button onClick={() => setShown(true)} className="flex items-center gap-2 text-sm text-brand-600 font-medium hover:underline">
        <Phone size={15} /> {shown ? phone : "Show Number"}
      </button>
    );
  }
  return (
    <button onClick={() => setShown(true)} className="btn-primary px-4 py-2.5">
      <Phone size={16} /> {shown ? phone : "Show Number"}
    </button>
  );
}

export function WhatsappLink({ phone }: { phone: string }) {
  const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
  return (
    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2.5 !text-emerald-700 !border-emerald-300">
      <MessageSquare size={16} /> WhatsApp
    </a>
  );
}

export function ShareButton({ name }: { name: string }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard blocked — no-op
    }
  }
  return (
    <button onClick={share} className="btn-secondary px-3 py-2.5" title="Share">
      <Share2 size={16} />
    </button>
  );
}

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — no-op
    }
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-brand-600 font-medium hover:underline text-sm">
      <Copy size={14} /> {copied ? "Copied!" : "Copy"}
    </button>
  );
}
