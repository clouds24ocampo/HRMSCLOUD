import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { orientationOpen } from "@/lib/orientation";
import { Badge, Card } from "@/components/ui";
import { SignPolicyForm } from "@/app/(app)/policies/PolicyForms";
import { signApplicantPolicy } from "../../actions";

// One company policy, read and signed on orientation day.
export default async function ApplicantPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/apply");
  const profile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: me.id } });
  const policy = await prisma.policyDocument.findFirst({ where: { id, organizationId: me.organizationId, archivedAt: null, requiresSignature: true } });
  if (!policy) notFound();
  const tz = (await getOrgSettings(me.organizationId)).timezone;
  const scheduled = (await prisma.applicant.findMany({ where: { profileId: profile.id, orientationAt: { not: null } }, select: { orientationAt: true } })).map((a) => a.orientationAt!);
  if (scheduled.length === 0) redirect("/apply");
  const open = orientationOpen(scheduled, new Date(), tz);
  const signed = await prisma.applicantPolicySignature.findUnique({ where: { policyId_profileId: { policyId: id, profileId: profile.id } } });

  return (
    <>
      <Link href="/apply" className="text-sm font-medium text-muted hover:text-ink">← Back to my application</Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{policy.title}</h1>
          {signed ? <Badge tone="success">Signed</Badge> : <Badge tone="warning">Needs your signature</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">Version {policy.version}. Please read it in full before you sign.</p>
        {policy.storageKey ? (
          <div className="mt-4">
            <a href={`/apply/policies/${policy.id}/file`} target="_blank" className="font-semibold text-brand hover:underline">Open the policy (PDF)</a>
            <iframe title={policy.title} src={`/apply/policies/${policy.id}/file`} className="mt-3 h-[32rem] w-full rounded-xl border border-line" />
          </div>
        ) : (
          <div className="mt-4 whitespace-pre-wrap rounded-xl bg-bg p-4 text-sm leading-relaxed">{policy.body}</div>
        )}
      </Card>
      {!signed && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Sign this policy</h2>
          {open ? <SignPolicyForm policyId={policy.id} defaultName={me.name} action={signApplicantPolicy} /> : <p className="text-sm text-muted">Signing opens on your orientation day.</p>}
        </Card>
      )}
      {signed && <p className="text-sm text-muted">You signed this policy as {signed.signedName}. A copy of your signature is kept with this version.</p>}
    </>
  );
}
