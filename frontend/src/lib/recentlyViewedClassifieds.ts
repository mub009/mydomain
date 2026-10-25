const KEY = "mydomain-recently-viewed-classifieds";
const MAX_ITEMS = 20;

export function getRecentlyViewedClassifieds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function rememberRecentlyViewedClassified(id: string): void {
  try {
    const next = [id, ...getRecentlyViewedClassifieds().filter((x) => x !== id)].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, quota) — just won't persist
  }
}
