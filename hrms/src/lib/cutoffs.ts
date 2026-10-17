// Fixed semi-monthly cut-offs. Pure: day keys in, day keys out.
//   1st to 15th            -> paid on the last day of the same month (30th or 31st; 28th or 29th in February)
//   16th to the month end  -> paid on the 15th of the next month
// The two never overlap and together cover every day, so a day's hours are paid exactly once.
import { addDays } from "@/lib/time";

export type Cutoff = { name: string; start: string; end: string; payDate: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

export function cutoffFor(day: string): Cutoff {
  const [y, m, d] = day.split("-").map(Number);
  const last = lastDayOf(y, m);
  const ym = `${y}-${pad(m)}`;
  if (d <= 15) return { name: `${MONTHS[m - 1]} 1–15, ${y}`, start: `${ym}-01`, end: `${ym}-15`, payDate: `${ym}-${pad(last)}` };
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return { name: `${MONTHS[m - 1]} 16–${last}, ${y}`, start: `${ym}-16`, end: `${ym}-${pad(last)}`, payDate: `${next}-15` };
}

// The cut-off before the one holding this day.
export const previousCutoff = (day: string) => cutoffFor(addDays(cutoffFor(day).start, -1));
