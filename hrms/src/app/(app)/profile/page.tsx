import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, PageHeader, buttonClass, ghostClass } from "@/components/ui";
import { commitmentRecord } from "@/lib/exam-results";
import { OATH, asLang, type Answers } from "@/lib/exams";
import { canAccess } from "@/lib/roles";
import { ContactForm, MyPhotoForm, NumbersForm } from "./ProfileForms";

// The signed-in person's own account: picture (printed on their ID), contact details, and government numbers.
export default async function ProfilePage() {
  const me = await requireUser("/profile");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const e = await prisma.employee.findUniqueOrThrow({
    where: { id: mine.id },
    select: {
      id: true, firstName: true, lastName: true, employeeNo: true, phone: true, address: true, birthDate: true, hireDate: true, photoKey: true,
      sssNo: true, philhealthNo: true, tinNo: true, pagibigNo: true, position: { select: { title: true } }, department: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  });
  // The commitment exam they took as an applicant stays on their account while they work here: the oath and their own answers.
  const pledge = await prisma.examAttempt.findFirst({
    where: { submittedAt: { not: null }, exam: { kind: "COMMITMENT" }, applicant: { organizationId: me.organizationId, profile: { userId: me.id } } },
    orderBy: { submittedAt: "desc" },
    select: { lang: true, oathAt: true, submittedAt: true, answers: true, exam: { select: { title: true, questions: { select: { id: true, text: true, textTl: true, trait: true, options: true, sort: true } } } } },
  });
  const pledgeLang = asLang(pledge?.lang);
  const pledgeRows = pledge ? commitmentRecord(pledge.exam.questions, (pledge.answers ?? {}) as Answers, pledgeLang) : [];
  const missing = [!e.sssNo && "SSS", !e.philhealthNo && "PhilHealth", !e.tinNo && "TIN", !e.pagibigNo && "Pag-IBIG"].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="My profile" subtitle="Your account, your picture and your government numbers. The picture and numbers appear on your digital ID, which HR prints." action={<div className="flex flex-wrap gap-2">{canAccess(me.role.key, "/id") && <Link href="/id" className={buttonClass}>View my digital ID</Link>}<Link href="/change-password" className={ghostClass}>Change password</Link></div>} />

      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <span className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-bg ring-1 ring-line">
            {e.photoKey
              // eslint-disable-next-line @next/next/no-img-element -- private picture behind a signed-in route
              ? <img src={`/employees/${e.id}/photo?v=${e.photoKey.slice(-8)}`} alt="Your profile picture" className="h-full w-full object-cover" />
              : <span className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">No picture yet</span>}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold">{e.firstName} {e.lastName}</p>
            <p className="text-muted">{[e.position?.title, e.department?.name].filter(Boolean).join(" · ") || "No position yet"}</p>
            <p className="mt-1 flex flex-wrap gap-2 text-sm"><Badge>{me.role.name}</Badge><Badge tone="brand">ID {e.employeeNo}</Badge></p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Email (sign-in)</dt><dd className="font-medium [overflow-wrap:anywhere]">{me.email}</dd></div>
          <div><dt className="text-muted">Date hired</dt><dd className="font-medium">{formatDay(keyOfDbDate(e.hireDate), { month: "long", day: "numeric", year: "numeric" })}</dd></div>
          <div><dt className="text-muted">Supervisor</dt><dd className="font-medium">{e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : "–"}</dd></div>
          <div><dt className="text-muted">Organization</dt><dd className="font-medium">{me.organization.name}</dd></div>
        </dl>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="h-fit space-y-3">
          <h2 className="text-lg font-semibold">{e.photoKey ? "Change my picture" : "Add my picture"}</h2>
          <p className="text-sm text-muted">A clear photo of your face on a plain background. It is placed on your ID automatically.</p>
          <MyPhotoForm />
        </Card>
        <Card className="h-fit space-y-3">
          <h2 className="text-lg font-semibold">My details</h2>
          <ContactForm v={{ phone: e.phone ?? "", address: e.address ?? "", birthDate: e.birthDate ? keyOfDbDate(e.birthDate) : "" }} />
        </Card>
      </div>

      {pledge && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">My commitment to the corporation</h2>
            <Badge tone="brand">{pledge.oathAt ? `Oath taken ${formatDay(dayKey(pledge.oathAt, settings.timezone), { month: "long", day: "numeric", year: "numeric" })}` : "Submitted"}</Badge>
          </div>
          <p className="text-sm text-muted">You took the {pledge.exam.title} before you were hired. These are your own answers, and the oath you made with them. They stay on your account as a reminder of what you promised while you work here.</p>
          <blockquote className="rounded-xl border-l-4 border-brand bg-brand/5 p-4 text-sm leading-relaxed">
            <p className="font-semibold text-brand">{OATH[pledgeLang].title}</p>
            <p className="mt-1">{OATH[pledgeLang].text}</p>
          </blockquote>
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold">My {pledgeRows.length} answers</summary>
            <ol className="mt-3 space-y-3 text-sm">
              {pledgeRows.map((r) => (
                <li key={r.n}>
                  <p className="font-medium">{r.n}. {r.question}</p>
                  <p className="mt-0.5 text-muted">{r.chosen ?? "Not answered"}</p>
                </li>
              ))}
            </ol>
          </details>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Government numbers</h2>
          {missing.length > 0 && <Badge tone="warning">Still needed: {missing.join(", ")}</Badge>}
        </div>
        <NumbersForm v={{ sss: e.sssNo ?? "", philhealth: e.philhealthNo ?? "", tin: e.tinNo ?? "", pagibig: e.pagibigNo ?? "" }} />
      </Card>
    </div>
  );
}
