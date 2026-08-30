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
