/** What a Zerodha refresh changed: stocks sold (removed from the saved list) and new ones. */
export type Change = { accountId: number; clientId: string; symbol: string; qty: number };
export interface Refreshed { removed: Change[]; added: Change[]; errors: { accountId: number; clientId: string; message: string }[] }

/** One line for the page: [text, good?]. */
export function refreshNote(r: Refreshed, accounts: number): [string, boolean] {
  const list = (xs: Change[]) => xs.map((x) => `${x.symbol} (${x.qty} sh${accounts > 1 ? `, ${x.clientId}` : ""})`).join(", ");
  if (r.errors.length) return [`Couldn't refresh ${r.errors.map((e) => e.clientId).join(", ")}: ${r.errors[0].message}`, false];
  const parts = [
    r.removed.length ? `Removed ${r.removed.length} sold: ${list(r.removed)}` : "",
    r.added.length ? `New: ${list(r.added)}` : "",
  ].filter(Boolean);
  return [parts.length ? `Refreshed from Zerodha. ${parts.join(". ")}.` : "Refreshed from Zerodha. No stocks bought or sold since the last refresh.", true];
}
