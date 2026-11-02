import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirectIfSignedIn } from "@/lib/auth";
import { careersOrg } from "@/lib/applicants";
import { ApplicantLogin } from "./ApplicantLogin";

export const metadata = { title: "Applicant sign in" };

// The applicant sign-in. Staff use /login; the two never share a page, a session rule or the operations log.
export default async function ApplicantLoginPage() {
  await redirectIfSignedIn();
  const org = await careersOrg();
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900 sm:px-8">
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between rounded-full border border-line bg-white py-2 pr-2 pl-5 shadow-sm">
        <Link href="/careers" className="flex items-center gap-2 font-headline text-lg font-medium text-brand"><Logo className="h-6 w-6" /> {org?.name ?? "HRMS"} <span className="font-normal text-slate-400">Careers</span></Link>
        <Link href="/careers" className="rounded-full border border-line px-5 py-2.5 text-sm font-medium transition hover:border-brand hover:text-brand">Open positions</Link>
      </header>
      <main className="mx-auto max-w-md rounded-3xl border border-line bg-white p-7 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Applicant sign in</h1>
        <p className="mt-2 mb-6 text-sm text-muted">Continue your application: upload your documents and take the exams.</p>
        <ApplicantLogin />
        <p className="mt-6 text-center text-sm text-muted">New applicant? <Link href="/careers/register" className="font-semibold text-brand hover:underline">Create an account</Link></p>
        <p className="mt-3 text-center text-xs text-muted">Company staff sign in <Link href="/login" className="font-semibold hover:underline">here</Link>.</p>
      </main>
    </div>
  );
}
