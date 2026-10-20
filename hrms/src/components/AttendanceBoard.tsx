import { mapUrl } from "@/lib/locale";
import Link from "next/link";
import type { BoardRow, StampPlace } from "@/lib/team-dtr";
import { formatDuration, formatTime } from "@/lib/time";
import { Badge } from "@/components/ui";
import { StatusTag, statusTag } from "@/components/LiveStatus";

const SOURCE: Record<string, string> = { GPS: "phone GPS", WIFI: "browser (Wi-Fi)", PHONE_LINK: "confirmed by phone", NONE: "no location" };
const DEVICE_ICON: Record<string, string> = { PHONE: "📱", TABLET: "📱", DESKTOP: "💻" };


// One stamp: the time, and where it was made (map link, accuracy, how the location was found).
export function Place({ p, tz }: { p: StampPlace | null; tz: string }) {
  if (!p) return <span className="text-muted">—</span>;
  const weak = p.gpsStatus !== "OK";
  return (
    <span className="block leading-tight">
      <span className="font-medium tabular-nums">{formatTime(p.at, tz)}</span>{" "}
      {p.device && <span aria-label={p.device.toLowerCase()} title={p.device.toLowerCase()}>{DEVICE_ICON[p.device] ?? ""}</span>}
      <span className="block text-xs">
        {p.lat != null && p.lng != null ? (
          <a href={mapUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className={`hover:underline ${weak ? "text-warning" : "text-brand"}`}>
            📍 ±{Math.round(p.accuracy ?? 0)} m{p.locSource ? ` · ${SOURCE[p.locSource] ?? p.locSource}` : ""}
          </a>
        ) : (
          <span className="text-danger">No location{p.ipAddress ? ` · IP ${p.ipAddress}` : ""}</span>
        )}
      </span>
    </span>
  );
}

export function AttendanceBoard({ rows, names, tz }: { rows: BoardRow[]; names: Map<string, { name: string; dept: string | null }>; tz: string }) {
  const now = new Date();
  const rank = (r: BoardRow) => (r.today?.lateMinutes ? 0 : r.today?.status === "ABSENT" ? 1 : r.today?.status === "INCOMPLETE" ? 2 : r.today?.status === "PRESENT" ? 3 : 4);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || (b.today?.lateMinutes ?? 0) - (a.today?.lateMinutes ?? 0) || (names.get(a.id)?.name ?? "").localeCompare(names.get(b.id)?.name ?? ""));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Employee</th><th className="font-medium">Now</th><th className="font-medium">Schedule</th><th className="font-medium">Time in</th><th className="font-medium">Time out</th>
            <th className="font-medium">Worked</th><th className="font-medium">Today</th><th className="font-medium">Cut-off so far</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line align-top">
          {sorted.map((r) => {
            const n = names.get(r.id);
            const t = r.today;
            return (
              <tr key={r.id}>
                <td className="py-2 pr-2">
                  <Link href={`/dtr?employee=${r.id}`} className="font-medium hover:underline">{n?.name}</Link>
                  {n?.dept && <span className="block text-xs text-muted">{n.dept}</span>}
                </td>
                <td className="pr-2"><StatusTag t={statusTag(r.live, !!t?.flex, t?.lateMinutes ?? 0, tz, now)} /></td>
                <td className="pr-2 text-muted">{t?.shift ? `${t.shift.startTime}–${t.shift.endTime}` : t?.flex ? "Flexible" : t?.status === "DAY_OFF" ? "Day off" : "—"}</td>
                <td className="pr-2"><Place p={r.firstIn} tz={tz} /></td>
                <td className="pr-2"><Place p={r.lastOut} tz={tz} /></td>
                <td className="pr-2 tabular-nums">{t?.workedMinutes ? formatDuration(t.workedMinutes) : "—"}</td>
                <td className="pr-2">
                  <span className="flex flex-wrap gap-1">
                    {t?.lateMinutes ? <Badge tone="danger">Late {formatDuration(t.lateMinutes)}</Badge> : null}
                    {t?.status === "PRESENT" && !t.lateMinutes && <Badge tone="success">On time</Badge>}
                    {t?.status === "INCOMPLETE" && <Badge tone="brand">Working</Badge>}
                    {t?.status === "ABSENT" && <Badge tone="danger">Absent</Badge>}
                    {t?.status === "LEAVE" && <Badge tone="brand">On leave</Badge>}
                    {(!t || t.status === "NO_SCHEDULE") && !r.firstIn && <Badge>Not in</Badge>}
                    {t?.undertimeMinutes && t.status === "PRESENT" ? <Badge tone="warning">Under {formatDuration(t.undertimeMinutes)}</Badge> : null}
                  </span>
                </td>
                <td className="text-xs">
                  {r.lateDays ? <span className="text-danger">{r.lateDays} late · {formatDuration(r.lateMinutes)}</span> : <span className="text-muted">No lates</span>}
                  {r.absentDays > 0 && <span className="block text-danger">{r.absentDays} absent</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
