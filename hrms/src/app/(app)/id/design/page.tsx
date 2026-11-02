import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { DEFAULT_TERMS, idCardFor, idDesign } from "@/lib/id-card";
import { Card, PageHeader } from "@/components/ui";
import { IdCard } from "../IdCard";
import { IdDesignForm } from "../IdForms";

// HR designs the card once; every employee's ID is drawn from it. The preview uses your own record.
export default async function IdDesignPage() {
  const me = await requireUser("/id/design");
  const mine = await getMyEmployee(me);
  const [d, preview] = await Promise.all([idDesign(me.organizationId), idCardFor(me.organizationId, mine.id, { revealNumbers: true })]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/id" className="text-sm font-medium text-muted hover:text-ink">← Digital ID</Link>
      <PageHeader title="ID design" subtitle="What every employee's digital ID shows, front and back: company logo, address, color, fields, terms and conditions, signatory and signature. The QR code is always on the back." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <IdDesignForm
            d={{
              title: d?.title ?? "EMPLOYEE ID", hasLogo: !!d?.logoKey,
              showPosition: d?.showPosition ?? true, showDepartment: d?.showDepartment ?? true, showHireDate: d?.showHireDate ?? true, showEmployeeNo: d?.showEmployeeNo ?? true,
              signatoryName: d?.signatoryName ?? "", signatoryTitle: d?.signatoryTitle ?? "", footer: d?.footer ?? "",
              address: d?.address ?? "", terms: d?.terms ?? DEFAULT_TERMS.join("\n"), validYears: d?.validYears ?? 2,
            }}
          />
        </Card>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Preview (your own card)</p>
          {preview && <IdCard d={preview} className="space-y-4" />}
        </div>
      </div>
    </div>
  );
}
