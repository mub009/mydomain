// Business hours are stored as 24-hour "HH:MM" strings; every customer-facing
// display renders them as a 12-hour clock instead, since that's what people
// read at a glance ("9am–6pm" not "09:00–18:00").
export function to12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}.${String(m).padStart(2, "0")}${period}` : `${hour}${period}`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface OpenStatus {
  open: boolean;
  label: string;
  detail: string;
}

export function getOpenStatus(hours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>): OpenStatus | null {
  if (!hours || hours.length === 0) return null;
  const now = new Date();
  const today = hours.find((h) => h.dayOfWeek === now.getDay());
  if (!today) return null;
  if (today.isClosed) return { open: false, label: "Closed today", detail: "Opens as per weekly hours" };

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const open = toMin(today.openTime);
  const close = toMin(today.closeTime);

  if (nowMin >= open && nowMin < close) {
    return { open: true, label: "Open now", detail: `Closes at ${to12Hour(today.closeTime)}` };
  }
  if (nowMin < open) {
    return { open: false, label: "Closed", detail: `Opens at ${to12Hour(today.openTime)}` };
  }
  return { open: false, label: "Closed", detail: "Opens tomorrow" };
}
