import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { emptyPds, sanitizePds } from "@/lib/pds";
import { PdsForm } from "./PdsForm";

export const metadata = { title: "Personal Data Sheet" };

// The applicant's Personal Data Sheet. It starts with their name, email and mobile number already filled in.
export default async function PdsPage() {
  const me = await requireUser("/apply");
  const profile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: me.id }, select: { id: true, phone: true } });
  const saved = await prisma.personalDataSheet.findUnique({ where: { profileId: profile.id }, select: { data: true, submittedAt: true } });
  const initial = saved ? sanitizePds(saved.data) : emptyPds({ email: me.email, name: me.name, mobile: profile.phone ?? "" });
  return (
    <>
      <Link href="/apply" className="text-sm font-medium text-muted hover:text-ink">← Back to my application</Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Personal Data Sheet</h1>
        <p className="mt-1 text-sm text-muted">One form for everything we need to know about you for your employee file: your details, contact and social media, family, education, work history, references and emergency contact. Please be complete and honest. Your information is protected under the Data Privacy Act of 2012 and is seen only by HR.</p>
      </div>
      <PdsForm initial={initial} submittedBefore={!!saved?.submittedAt} />
    </>
  );
}
