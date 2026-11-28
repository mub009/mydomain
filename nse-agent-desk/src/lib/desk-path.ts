/** Paths the NSE Desk API proxy may forward. */

/** Each path part: letters, digits, _ - and, for stock symbols, & and . (auth/login, zerodha/accounts/12, watchlist/M&M). */
const SEGMENT = /^[A-Za-z0-9_&.-]+$/;
export const safePath = (parts: string[]) => parts.length > 0 && parts.every((p) => SEGMENT.test(p) && p !== "." && p !== "..");
