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
    <div role="radiogroup" aria-label={label} className={cn("inline-flex h-9 items-center rounded-lg border bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full rounded-md px-2.5 text-[13px] font-medium tnum transition-colors",
            o.value === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
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
  "h-9 rounded-lg border bg-card px-3 text-sm tnum placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-primary";
