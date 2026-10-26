import { Icon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DOC_CATEGORIES, items201, load201 } from "@/lib/documents";
import { FILE_201_CATEGORY } from "@/lib/file201";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { addDays, dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, inputClass, buttonClass } from "@/components/ui";
import { ArchiveDocButton, UploadForm } from "./DocumentForms";
import { File201 } from "./File201";

const SOON_DAYS = 60;
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/documents");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);
  // Only HR can look at someone else's file. Everyone else sees their own, whatever the URL says.
  const employeeId = hr && sp.employee ? sp.employee : mine.id;
  const today = dayKey(new Date(), settings.timezone);
  const soon = addDays(today, SOON_DAYS);
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });

  const person = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { id: true, firstName: true, lastName: true, employeeNo: true } });
  if (!person) return <EmptyState title="Employee not found" />;
  const [docs, people, expiring] = await Promise.all([
    prisma.employeeDocument.findMany({ where: { employeeId, organizationId: me.organizationId }, orderBy: [{ title: "asc" }, { version: "desc" }] }),
    hr ? prisma.employee.findMany({ where: { organizationId: me.organizationId }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" }, take: 300 }) : [],
    hr
      ? prisma.employeeDocument.findMany({
          where: { organizationId: me.organizationId, archivedAt: null, expiresOn: { not: null, lte: new Date(`${soon}T00:00:00Z`) } },
          include: { employee: { select: { firstName: true, lastName: true } } },
          orderBy: { expiresOn: "asc" },
          take: 50,
        })
      : [],
  ]);
  const current = docs.filter((d) => !d.archivedAt && d.category !== FILE_201_CATEGORY);
  const f201 = items201((await load201(me.organizationId, [employeeId])).get(employeeId));
  const older = docs.filter((d) => d.archivedAt);
  const state = (d: { expiresOn: Date | null }) => (d.expiresOn ? (keyOfDbDate(d.expiresOn) < today ? "expired" : keyOfDbDate(d.expiresOn) <= soon ? "soon" : "ok") : null);
  const own = employeeId === mine.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Documents" action={<Link href="/policies" className={buttonClass}><Icon name="policies" className={ICON_INLINE} /> Company policies</Link>} subtitle={own ? "Your personal file: contracts, IDs and certificates. Only you and HR can open them." : `${person.firstName} ${person.lastName}'s file. Opening a file is recorded in the audit log.`} />

      {hr && (
        <form className="flex flex-wrap items-end gap-2" role="search">
          <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
            Whose file
            <select name="employee" defaultValue={employeeId} className={inputClass}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.employeeNo}{p.id === mine.id ? " (me)" : ""}</option>)}
            </select>
          </label>
          <button className={buttonClass}>Open</button>
        </form>
      )}

      {hr && expiring.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Expiring within {SOON_DAYS} days <Badge tone="danger">{expiring.length}</Badge></h2>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {expiring.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span><span className="font-medium">{d.employee.firstName} {d.employee.lastName}</span> · {d.title}</span>
                <span className="flex items-center gap-2 text-muted">{fmt(d.expiresOn!)} {state(d) === "expired" ? <Badge tone="danger">Expired</Badge> : <Badge tone="warning">Soon</Badge>}
                  <Link href={`/documents?employee=${d.employeeId}`} className="font-medium text-brand hover:underline">Open file</Link></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="scroll-mt-6 space-y-3">
        <span id="file201" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">201 file</h2>
          <p className="text-sm text-muted">The personnel record every employee keeps with HR: IDs, clearances and government numbers.</p>
        </div>
        <File201 employeeId={employeeId} items={f201} mandatory={own && !hr} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Other documents</h2>
        {current.length === 0 ? <EmptyState title="No documents yet" hint="Upload one below." /> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {current.map((d) => {
              const s = state(d);
              const versions = older.filter((o) => o.title === d.title);
              return (
                <li key={d.id} className="px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{d.title} {d.version > 1 && <span className="text-xs font-normal text-muted">version {d.version}</span>}</p>
                      <p className="text-sm text-muted">{d.category} · {d.fileName} · {size(d.sizeBytes)}{d.expiresOn ? ` · expires ${fmt(d.expiresOn)}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s === "expired" && <Badge tone="danger">Expired</Badge>}
                      {s === "soon" && <Badge tone="warning">Expires soon</Badge>}
                      <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg">Open</a>
                      {hr && <ArchiveDocButton id={d.id} title={d.title} />}
                    </div>
                  </div>
                  {versions.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-muted">Older versions ({versions.length})</summary>
                      <ul className="mt-1 space-y-1">{versions.map((o) => <li key={o.id}>Version {o.version} · {o.fileName} · <a href={`/documents/${o.id}/file`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">Open</a></li>)}</ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Upload a document</h2>
        <UploadForm employeeId={employeeId} categories={DOC_CATEGORIES.filter((c) => c !== FILE_201_CATEGORY)} />
      </Card>
    </div>
  );
}
