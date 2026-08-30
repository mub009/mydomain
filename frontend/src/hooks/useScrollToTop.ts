import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// BrowserRouter doesn't reset scroll position between route changes the way
// a traditional multi-page site does, so navigating to a new page (e.g.
// clicking a business card partway down a scrolled search-results list)
// otherwise lands already scrolled down instead of at the top. Keyed on
// pathname only — a filter/pagination change on the same page (e.g.
// SearchResults) already handles its own scroll and shouldn't be reset here.
export function useScrollToTop(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
}
