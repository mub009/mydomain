/**
 * Quiet hours. A campaign of a few hundred messages at eight seconds apart
 * runs for hours, so one started in the evening would otherwise still be
 * going at 3am — which annoys customers and is exactly the pattern that gets
 * a number reported.
 *
 * Hours are whole numbers of server local time. The window may wrap past
 * midnight (22 → 6 means "overnight"), and start === end means "any time".
 */

export interface SendingWindow {
  windowStartHour: number;
  windowEndHour: number;
}

export function isWithinWindow(window: SendingWindow, at: Date = new Date()): boolean {
  const { windowStartHour: start, windowEndHour: end } = window;
  if (start === end) return true;

  const hour = at.getHours();
  // A window that wraps midnight is two ranges: [start, 24) and [0, end).
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/**
 * Milliseconds until the window next opens. Used to park the dispatcher until
 * morning instead of having it wake every few seconds all night.
 */
export function msUntilWindowOpens(window: SendingWindow, at: Date = new Date()): number {
  if (isWithinWindow(window, at)) return 0;

  const opensAt = new Date(at);
  opensAt.setMinutes(0, 0, 0);
  opensAt.setHours(window.windowStartHour);
  // Already past today's opening hour, so the next one is tomorrow.
  if (opensAt <= at) opensAt.setDate(opensAt.getDate() + 1);

  return opensAt.getTime() - at.getTime();
}

/** Human wording for the dashboard, e.g. "9am – 9pm". */
export function describeWindow(window: SendingWindow): string {
  if (window.windowStartHour === window.windowEndHour) return "any time";
  const label = (hour: number) => {
    if (hour === 0) return "12am";
    if (hour === 12) return "12pm";
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };
  return `${label(window.windowStartHour)} – ${label(window.windowEndHour)}`;
}
