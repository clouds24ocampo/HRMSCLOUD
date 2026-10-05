// Holidays fixed by law (RA 9492 and the Administrative Code) for a year. Holy Week follows Easter.
// Holidays proclaimed each year (Eid'l Fitr, Eid'l Adha, extra special days, moved dates) are entered by HR.
import type { HolidayKind } from "@/lib/ph/premium";
import { addDays } from "@/lib/time";

// Western Easter (Meeus/Jones/Butcher algorithm).
export function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastMonday(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const back = (last.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - back)).toISOString().slice(0, 10);
}

export type HolidaySuggestion = { date: string; name: string; type: HolidayKind };
export function standardHolidays(year: number): HolidaySuggestion[] {
  const e = easter(year);
  const y = (md: string) => `${year}-${md}`;
  return [
    { date: y("01-01"), name: "New Year's Day", type: "REGULAR" },
    { date: addDays(e, -3), name: "Maundy Thursday", type: "REGULAR" },
    { date: addDays(e, -2), name: "Good Friday", type: "REGULAR" },
    { date: addDays(e, -1), name: "Black Saturday", type: "SPECIAL_NON_WORKING" },
    { date: y("04-09"), name: "Araw ng Kagitingan", type: "REGULAR" },
    { date: y("05-01"), name: "Labor Day", type: "REGULAR" },
    { date: y("06-12"), name: "Independence Day", type: "REGULAR" },
    { date: y("08-21"), name: "Ninoy Aquino Day", type: "SPECIAL_NON_WORKING" },
    { date: lastMonday(year, 8), name: "National Heroes Day", type: "REGULAR" },
    { date: y("11-01"), name: "All Saints' Day", type: "SPECIAL_NON_WORKING" },
    { date: y("11-30"), name: "Bonifacio Day", type: "REGULAR" },
    { date: y("12-08"), name: "Feast of the Immaculate Conception", type: "SPECIAL_NON_WORKING" },
    { date: y("12-25"), name: "Christmas Day", type: "REGULAR" },
    { date: y("12-30"), name: "Rizal Day", type: "REGULAR" },
    { date: y("12-31"), name: "Last Day of the Year", type: "SPECIAL_NON_WORKING" },
  ];
}
