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
        <Link href="/careers" className="flex min-w-0 items-center gap-2 font-headline text-base font-medium text-brand sm:text-lg"><Logo className="h-6 w-6 shrink-0" /> <span className="truncate">{org?.name ?? "HRMS"}</span> <span className="hidden font-normal text-slate-400 sm:inline">Careers</span></Link>
        <Link href="/careers/login" className="shrink-0 whitespace-nowrap rounded-full border border-line px-4 py-2.5 text-sm font-medium transition hover:border-brand hover:text-brand sm:px-5">Sign in</Link>
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
