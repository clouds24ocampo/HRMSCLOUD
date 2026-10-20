// Draws a DtrReport as a PDF (A4, landscape). One section per person: a row per day, then the person's total.
// Built-in PDF fonts cannot show the peso sign, so amounts are written "PHP 1,234.56".
import { DEFAULT_LOCALE } from "@/lib/locale";
import PDFDocument from "pdfkit";
import type { DtrReport, ReportDay, ReportPerson } from "@/lib/dtr-report";
import { formatDay, formatTime } from "@/lib/time";

const php = (cents: number) => `PHP ${(cents / 100).toLocaleString(DEFAULT_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hm = (m: number) => (m <= 0 ? "-" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
// The standard PDF fonts only know Latin-1: anything else (emoji, other scripts) becomes "?" instead of garbage.
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

const MARGIN = 28;
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#d1d5db";
const ROW = 17;

type Col = { key: string; label: string; w: number; align?: "left" | "right" };

export function buildDtrPdf(report: DtrReport, opts: { compress?: boolean } = {}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGIN, bufferPages: true, compress: opts.compress ?? true, info: { Title: `DTR report ${report.from} to ${report.to}`, Author: report.organization } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const tz = report.timezone;
  const cols: Col[] = [
    { key: "date", label: "Date", w: 66 }, { key: "in", label: "Time in", w: 58 }, { key: "out", label: "Time out", w: 58 },
    { key: "break", label: "Breaks", w: 44, align: "right" }, { key: "issue", label: "Issues", w: 44, align: "right" },
    { key: "paid", label: "Hours paid", w: 56, align: "right" }, { key: "late", label: "Late", w: 40, align: "right" },
    { key: "under", label: "Under", w: 40, align: "right" }, { key: "ot", label: "Overtime", w: 50, align: "right" },
    { key: "flags", label: "Notes", w: report.wages ? 188 : 268 },
    ...(report.wages ? [{ key: "wage", label: "Daily wage", w: 82, align: "right" as const }] : []),
  ];
  const width = cols.reduce((n, c) => n + c.w, 0);
  const bottom = () => doc.page.height - MARGIN - 18; // leave room for the page footer

  const rowFor = (d: ReportDay): Record<string, string> => ({
    date: formatDay(d.day, { weekday: "short", month: "short", day: "numeric" }),
    in: d.timeIn ? formatTime(d.timeIn, tz) : "-", out: d.timeOut ? formatTime(d.timeOut, tz) : "-",
    break: hm(d.breakMinutes), issue: hm(d.issueMinutes), paid: hm(d.paidMinutes), late: hm(d.lateMinutes), under: hm(d.undertimeMinutes), ot: hm(d.overtimeMinutes),
    flags: d.flags.join(", "), wage: d.wageCents == null ? "" : php(d.wageCents),
  });

  const drawCells = (y: number, values: Record<string, string>, opt: { bold?: boolean; color?: string; fill?: string; size?: number } = {}) => {
    if (opt.fill) doc.rect(MARGIN, y - 3, width, ROW, ).fill(opt.fill);
    doc.fillColor(opt.color ?? INK).font(opt.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opt.size ?? 8);
    let x = MARGIN;
    for (const c of cols) {
      doc.text(safe(values[c.key] ?? ""), x + 3, y, { width: c.w - 6, align: c.align ?? "left", lineBreak: false, ellipsis: true });
      x += c.w;
    }
  };
  const tableHeader = (y: number) => {
    drawCells(y, Object.fromEntries(cols.map((c) => [c.key, c.label])), { bold: true, fill: "#f3f4f6", size: 8 });
    doc.moveTo(MARGIN, y + ROW - 4).lineTo(MARGIN + width, y + ROW - 4).strokeColor(LINE).lineWidth(0.5).stroke();
    return y + ROW;
  };

  const personHeader = (p: ReportPerson, cont: boolean) => {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(safe(`${p.name}${cont ? " (continued)" : ""}`), MARGIN, doc.y, { continued: false });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(
      safe(`${p.employeeNo}${p.department ? `  |  ${p.department}` : ""}${report.wages && p.dailyCents != null && p.hourlyCents != null ? `  |  Daily rate ${php(Math.round(p.dailyCents))}  |  Hourly rate ${php(Math.round(p.hourlyCents))}` : ""}`),
      MARGIN, doc.y,
    );
    doc.moveDown(0.4);
  };

  // ── Cover block
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text(safe(report.organization), MARGIN, MARGIN);
  doc.font("Helvetica").fontSize(11).fillColor(INK).text("Daily Time Record (DTR) report");
  doc.fillColor(MUTED).fontSize(9).text(`Period ${report.from} to ${report.to}  |  Times in ${tz}  |  Generated ${formatDay(report.generatedAt.toISOString().slice(0, 10), { month: "short", day: "numeric", year: "numeric" })} ${formatTime(report.generatedAt, tz)}`);
  doc.text(report.wages
    ? "Daily wage = hours paid x hourly rate, plus approved overtime at the overtime rate. Only time worked and On Trip count as hours paid: breaks and issues (weather, calamity, system...) are deducted."
    : "Pay is not shown on this copy.");
  doc.moveDown(0.8);

  for (const p of report.people) {
    if (doc.y > bottom() - 5 * ROW) doc.addPage();
    personHeader(p, false);
    let y = tableHeader(doc.y);
    if (p.days.length === 0) {
      doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9).text("No time stamps in this period.", MARGIN + 3, y);
      y += ROW;
    }
    for (const d of p.days) {
      if (y + ROW > bottom()) {
        doc.addPage();
        doc.y = MARGIN;
        personHeader(p, true);
        y = tableHeader(doc.y);
      }
      drawCells(y, rowFor(d), { color: d.status === "ABSENT" ? "#b91c1c" : INK });
      y += ROW;
    }
    // Person total
    if (y + ROW > bottom()) { doc.addPage(); y = MARGIN; }
    doc.moveTo(MARGIN, y - 3).lineTo(MARGIN + width, y - 3).strokeColor(INK).lineWidth(0.8).stroke();
    const t = p.totals;
    drawCells(y, {
      date: "TOTAL", in: `${t.daysWorked} day${t.daysWorked === 1 ? "" : "s"}`, out: t.absentDays ? `${t.absentDays} absent` : "",
      break: hm(t.breakMinutes), issue: hm(t.issueMinutes), paid: hm(t.paidMinutes), late: hm(t.lateMinutes), under: hm(t.undertimeMinutes), ot: hm(t.overtimeMinutes),
      flags: "", wage: t.wageCents == null ? "" : php(t.wageCents),
    }, { bold: true, fill: "#eef2ff", size: 8.5 });
    doc.y = y + ROW + 12;
  }

  // ── Grand total (pay copies only)
  if (report.wages && report.grandWageCents != null) {
    if (doc.y > bottom() - 40) doc.addPage();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(`Total daily wages, all ${report.people.length} employee${report.people.length === 1 ? "" : "s"}: ${php(report.grandWageCents)}`, MARGIN, doc.y);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Gross, before deductions such as cash advances and government contributions. The payslip shows the net pay.");
  }

  // ── Footers: page x of y
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`${safe(report.organization)}  |  DTR report ${report.from} to ${report.to}  |  Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - MARGIN - 8, { width: width, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
