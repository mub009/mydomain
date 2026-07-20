import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { searchApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category } from "@/types";
import StarRating from "@/components/StarRating";

export default function Home() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => undefined);
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await searchApi.search({
        q: query || undefined,
        city: city || undefined,
        categorySlug: categorySlug || undefined,
        sort: "rating",
      });
      setResults(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="bg-brand-600 text-white rounded-xl p-8 mb-8">
        <h1 className="text-3xl font-bold mb-2">Find local businesses near you</h1>
        <p className="text-brand-100 mb-6">Search, compare, and connect with the best-rated businesses in your city.</p>
        <form onSubmit={runSearch} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="sm:col-span-2 rounded-md px-3 py-2 text-gray-900"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="rounded-md px-3 py-2 text-gray-900"
          />
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="rounded-md px-3 py-2 text-gray-900"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="sm:col-span-4 bg-white text-brand-700 font-semibold rounded-md py-2">
            Search
          </button>
        </form>
      </section>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((b) => (
          <Link
            key={b.id}
            to={`/business/${b.slug}`}
            className="border rounded-lg bg-white p-4 hover:shadow-md transition-shadow"
          >
            <div className="text-xs text-brand-600 font-medium mb-1">{b.categoryName ?? b.category?.name}</div>
            <h3 className="font-semibold text-lg">{b.name}</h3>
            <p className="text-sm text-gray-500 mb-2">
              {b.city}, {b.state}
            </p>
            <StarRating rating={b.avgRating} count={b.reviewCount} />
          </Link>
        ))}
        {!loading && results.length === 0 && <p className="text-gray-500">No businesses found. Try a different search.</p>}
      </div>
    </div>
  );
}
