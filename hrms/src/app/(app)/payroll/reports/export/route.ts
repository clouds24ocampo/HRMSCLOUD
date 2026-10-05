import { requireUser } from "@/lib/auth";
import { csv, csvResponse, pesos } from "@/lib/csv";
import { AGENCY_LABEL, loadMonth, loadYear, type Agency } from "@/lib/ph/reports";

// Remittance lists, the 1601-C figures and the yearly BIR 2316 data as CSV. HR only (same rule as the Payroll pages).
export async function GET(req: Request) {
  const me = await requireUser("/payroll");
  const u = new URL(req.url);
  const type = (u.searchParams.get("type") ?? "").toUpperCase();
  const month = u.searchParams.get("month") ?? "";
  const year = u.searchParams.get("year") ?? "";

  if (type === "1601C" || type in AGENCY_LABEL) {
    if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Invalid month", { status: 400 });
    const m = await loadMonth(me.organizationId, month);
    if (type === "1601C") {
      const s = m.summary;
      return csvResponse(`1601C-${month}.csv`, csv([
        ["Line", "Amount"], ["Employees paid", s.employees], ["Total compensation", pesos(s.grossCents)], ["Minimum wage earner exempt pay", pesos(s.mweExemptCents)],
        ["13th month pay and other benefits (exempt)", pesos(s.benefitsExemptCents)], ["De minimis and other non-taxable", pesos(s.otherNonTaxableCents)],
        ["SSS/GSIS, PhilHealth, Pag-IBIG and union dues", pesos(s.mandatoryCents)], ["Taxable compensation", pesos(s.taxableCents)], ["Taxable 13th month and other benefits", pesos(s.benefitsTaxableCents)],
        ["Tax withheld", pesos(s.taxWithheldCents)],
      ]));
    }
    const agency = type as Agency;
    const rows = m.remit[agency];
    return csvResponse(`${agency}-${month}.csv`, csv([
      ["Employee no", "Name", `${AGENCY_LABEL[agency]} number`, "TIN", "Employee share", "Employer share", ...(agency === "SSS" ? ["EC (employer)"] : []), "Total"],
      ...rows.map((r) => [r.employeeNo, r.name, r.idNo, r.tin, pesos(r.employeeCents), pesos(r.employerCents), ...(agency === "SSS" ? [pesos(r.ecCents)] : []), pesos(r.employeeCents + r.employerCents + r.ecCents)]),
    ]));
  }
  if (type === "2316") {
    if (!/^\d{4}$/.test(year)) return new Response("Invalid year", { status: 400 });
    const y = await loadYear(me.organizationId, Number(year));
    return csvResponse(`2316-${year}.csv`, csv([
      ["Employee no", "Name", "TIN", "Gross compensation", "Minimum wage earner exempt", "13th month and benefits (exempt)", "De minimis and other non-taxable", "Contributions", "Taxable compensation", "Taxable 13th month and benefits", "Tax due for the year", "Tax withheld", "Over / (under) withheld"],
      ...y.rows.map((r) => [r.employeeNo, r.name, r.tin, pesos(r.grossCents), pesos(r.mweExemptCents), pesos(r.benefitsExemptCents), pesos(r.otherNonTaxableCents), pesos(r.mandatoryCents), pesos(r.taxableCents), pesos(r.benefitsTaxableCents), r.taxDueCents === null ? "" : pesos(r.taxDueCents), pesos(r.taxWithheldCents), r.taxDueCents === null ? "" : pesos(r.taxWithheldCents - r.taxDueCents)]),
    ]));
  }
  return new Response("Unknown report", { status: 400 });
}
