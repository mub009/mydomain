"use client";

import { cn } from "@/lib/utils";

/** Small segmented control for choosing one of a few options. */
export function Segmented<T extends string | number>({ value, onChange, options, label, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("well inline-flex h-10 items-center rounded-xl p-1", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full rounded-lg px-2.5 text-[13px] font-medium tnum transition-all",
            o.value === value ? "raised -translate-y-px font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export const inputClass =
  "well h-10 rounded-xl border-0 px-3 text-sm tnum placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-primary";
