"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";

export default function SearchHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (city) params.set("city", city);
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2.5">
      <div className="flex items-center gap-2 h-[52px] rounded-lg border border-gray-300 bg-white pl-3.5 pr-3 sm:w-64 shrink-0 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
        <MapPin size={16} className="text-gray-400 shrink-0" />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2 h-[52px] rounded-lg border border-gray-300 bg-white pl-3.5 pr-1.5 flex-1 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
        <Search size={18} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for restaurants, plumbers, salons…"
          className="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
        />
        <button type="submit" className="btn-primary h-10 px-5 shrink-0">
          <Search size={15} />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  );
}
