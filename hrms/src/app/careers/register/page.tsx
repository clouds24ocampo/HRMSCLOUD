import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirectIfSignedIn } from "@/lib/auth";
import { careersOrg, openJobs } from "@/lib/applicants";
import { ApplicantSignUp } from "./ApplicantSignUp";

export const metadata = { title: "Create your applicant account" };

export default async function ApplicantRegisterPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  await redirectIfSignedIn();
  const org = await careersOrg();
  const jobs = org ? await openJobs(org.id) : [];
  const { job } = await searchParams;
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900 sm:px-8">
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between rounded-full border border-line bg-white py-2 pr-2 pl-5 shadow-sm">
        <Link href="/careers" className="flex items-center gap-2 font-headline text-lg font-medium text-brand"><Logo className="h-6 w-6" /> {org?.name ?? "HRMS"} <span className="font-normal text-slate-400">Careers</span></Link>
        <Link href="/careers/login" className="rounded-full border border-line px-5 py-2.5 text-sm font-medium transition hover:border-brand hover:text-brand">Sign in</Link>
      </header>
      <main className="mx-auto max-w-md rounded-3xl border border-line bg-white p-7 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Create your applicant account</h1>
        <p className="mt-2 mb-6 text-sm text-muted">You will use it to take the exams and send your documents.</p>
        {org ? <ApplicantSignUp jobs={jobs.map((j) => ({ id: j.id, title: j.title }))} jobId={jobs.some((j) => j.id === job) ? job : undefined} /> : <p className="text-muted">Applications are not open yet.</p>}
        <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/careers/login" className="font-semibold text-brand hover:underline">Sign in</Link></p>
      </main>
    </div>
  );
}
