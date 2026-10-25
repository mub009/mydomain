"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/types";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

const BUSINESS_TYPE_OPTIONS = [
  { value: "", label: "All businesses" },
  { value: "B2C", label: "Consumer (B2C)" },
  { value: "B2B", label: "Business (B2B)" },
];

export default function SearchFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => update("category", e.target.value)}
        className="input w-auto"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("businessType") ?? ""}
        onChange={(e) => update("businessType", e.target.value)}
        className="input w-auto"
      >
        {BUSINESS_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select value={searchParams.get("sort") ?? "relevance"} onChange={(e) => update("sort", e.target.value)} className="input w-auto">
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
