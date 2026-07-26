import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Globe } from "lucide-react";
import { sitesApi, type PublishedSite } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Spinner } from "@/components/Loading";

// Renders a business's published website. The markup comes from the builder,
// so it is injected as-is inside a scoped wrapper; the owner's own CSS is
// namespaced under that wrapper to keep it from leaking into the app shell.
export default function PublicSite() {
  const { slug } = useParams<{ slug: string }>();
  const [site, setSite] = useState<PublishedSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    sitesApi
      .published(slug)
      .then(setSite)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (site) document.title = `${site.business.name} — Website`;
  }, [site]);

  if (loading) return <Spinner label="Loading website…" />;

  if (error || !site) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Globe size={28} />
        </span>
        <h1 className="mt-4 text-lg font-bold text-ink-900">Website not available</h1>
        <p className="mt-1 text-sm text-ink-500">{error || "This business has not published a website yet."}</p>
        <Link to={`/business/${slug}`} className="btn-primary mt-5 inline-flex px-4 py-2.5">
          View their listing instead
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Scope the site's own styles so they cannot restyle the app around it. */}
      <style>{`#mk-site-root{all:initial;display:block;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#mk-site-root *{box-sizing:border-box}
${site.css}`}</style>
      <div id="mk-site-root" dangerouslySetInnerHTML={{ __html: site.html }} />

      <p className="mt-6 text-center text-xs text-ink-400">
        <Link to={`/business/${site.business.slug}`} className="hover:text-brand-600 hover:underline">
          {site.business.name} on Markkito
        </Link>
      </p>
    </div>
  );
}
