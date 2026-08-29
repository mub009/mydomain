const KEY = "mydomain-visitor-id";

// A random id persisted in localStorage (not a cookie) so page views from
// the same browser can be grouped into one visitor for "online now" and
// "unique visitors" — with no account and no consent prompt needed.
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, quota) — the page view
    // still records, it just won't be recognized as the same visitor as
    // any other call in this session.
    return randomId();
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
