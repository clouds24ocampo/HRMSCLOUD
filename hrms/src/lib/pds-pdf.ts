// Draws a Personal Data Sheet as a PDF (A4, portrait): every section, every answer. It is made when the applicant is hired and
// kept in the new employee's 201 file, so HR has a printable copy that matches what the person submitted.
import PDFDocument from "pdfkit";
import { PDS_SECTIONS, type Field } from "@/lib/pds-config";
import { cond, type FieldsData, type PdsData, type RowsData } from "@/lib/pds";

// The standard PDF fonts only know Latin-1: anything else becomes "?" instead of garbage.
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");
const MARGIN = 40;
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#d1d5db";

function show(f: Field, v: string): string {
  if (f.type === "check") return v === "Yes" ? "Yes" : "No";
  return v;
}

export function buildPdsPdf(data: PdsData, meta: { company: string; applicantNo: string; name: string; submittedOn: string | null }): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, info: { Title: `Personal Data Sheet - ${safe(meta.name)}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const width = doc.page.width - MARGIN * 2;
  const room = (h: number) => { if (doc.y + h > doc.page.height - MARGIN - 20) doc.addPage(); };

  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(safe(meta.company).toUpperCase(), { width });
  doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text("PERSONAL DATA SHEET", { width });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`${safe(meta.name)}  |  Applicant no. ${safe(meta.applicantNo)}${meta.submittedOn ? `  |  Submitted ${meta.submittedOn}` : ""}`, { width });
  doc.moveDown(0.6);

  for (const s of PDS_SECTIONS) {
    room(46);
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(safe(s.title), { width });
    doc.moveTo(MARGIN, doc.y + 1).lineTo(MARGIN + width, doc.y + 1).strokeColor(LINE).lineWidth(0.7).stroke();
    doc.moveDown(0.4);
    if (s.kind === "fields") {
      const v = (data[s.key] ?? {}) as FieldsData;
      for (const f of s.fields) {
        if (!cond(f.showIf, v)) continue;
        const text = safe(show(f, v[f.key] ?? "") || "-");
        room(24);
        const y = doc.y;
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(safe(f.label), MARGIN, y, { width: width * 0.42 });
        const labelBottom = doc.y;
        doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(text, MARGIN + width * 0.45, y, { width: width * 0.55 });
        doc.y = Math.max(labelBottom, doc.y) + 3;
      }
    } else {
      const { none, rows } = ((data[s.key] ?? { none: false, rows: [] }) as RowsData);
      if (none && rows.length === 0) { doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(safe(s.none ?? "None"), MARGIN, doc.y, { width }); continue; }
      if (rows.length === 0) { doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text("Nothing listed.", MARGIN, doc.y, { width }); continue; }
      rows.forEach((r, i) => {
        room(40);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(`${s.rowLabel} ${i + 1}`, MARGIN, doc.y, { width });
        for (const c of s.columns) {
          if (!r[c.key]) continue;
          room(14);
          const y = doc.y;
          doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(safe(c.label), MARGIN + 10, y, { width: width * 0.38 });
          const labelBottom = doc.y;
          doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(safe(r[c.key]), MARGIN + width * 0.45, y, { width: width * 0.55 });
          doc.y = Math.max(labelBottom, doc.y) + 2;
        }
        doc.moveDown(0.3);
      });
    }
  }

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    doc.page.margins.bottom = 0; // the footer sits inside the bottom margin; without this the PDF adds an empty page for it
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`Page ${i + 1} of ${pages.count}  |  Confidential: personal information protected by the Data Privacy Act of 2012`, MARGIN, doc.page.height - MARGIN + 6, { width, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
