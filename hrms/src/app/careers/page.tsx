import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { careersOrg, openJobs } from "@/lib/applicants";
import { CareersBoard } from "./CareersBoard";

const STEPS = [
  ["1", "Create your account", "Pick one or more positions. You get an applicant number right away."],
  ["2", "Upload your resume and valid ID", "PDF, PNG or JPEG. Photos are made smaller for you."],
  ["3", "Take two short exams", "A personality exam, then questions about the job. Choose English or Tagalog."],
  ["4", "Interview, requirements, orientation", "We guide you step by step until you join the team."],
];

export const metadata = { title: "Careers" };

export default async function CareersPage() {
  const me = await getUser(); // staff and applicants may look at the page too; it never redirects
  const org = await careersOrg();
  const jobs = org ? await openJobs(org.id) : [];
  const applicant = me?.role.key === "APPLICANT";
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/careers" className="flex items-center gap-2 font-headline text-lg font-medium text-brand"><Logo className="h-7 w-7" /> {org?.name ?? "HRMS"} <span className="font-normal text-slate-400">Careers</span></Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <a href="#positions" className="hidden rounded-full px-4 py-2 text-slate-600 hover:text-brand sm:block">Open positions</a>
            <Link href={me ? homeFor(me.role.key) : "/careers/login"} className="rounded-full border border-line px-4 py-2 transition hover:border-brand hover:text-brand">{!me ? "Applicant sign in" : applicant ? "My application" : "Back to workspace"}</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="relative overflow-hidden py-14 text-center sm:py-20">
          <span aria-hidden className="absolute left-1/2 top-0 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand/[0.07] blur-3xl" />
          <p className="inline-block rounded-full bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand">We are hiring{jobs.length ? `: ${jobs.length} open positions` : ""}</p>
          <h1 className="mx-auto mt-5 max-w-3xl font-headline text-4xl font-medium tracking-tight text-balance sm:text-6xl">Build your career with {org?.name ?? "us"}.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500">Software, cloud, networks, digital security and field operations. Find the role that fits you, apply online from any phone, and track every step.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#positions" className="rounded-full bg-brand px-7 py-3 font-semibold text-brand-ink shadow-lg shadow-brand/25 transition hover:brightness-110 active:scale-95">See open positions</a>
            <a href="#how" className="rounded-full border border-line px-7 py-3 font-semibold transition hover:border-brand hover:text-brand">How it works</a>
          </div>
        </section>

        <CareersBoard
          signedInApplicant={applicant}
          jobs={jobs.map((j) => ({ id: j.id, title: j.title, department: j.department?.name ?? null, openings: j.openings, description: j.description, descriptionTl: j.descriptionTl, duties: j.duties, dutiesTl: j.dutiesTl }))}
        />

        <section id="how" aria-label="How applying works" className="scroll-mt-6 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">How applying works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="rounded-3xl border border-line bg-slate-50 p-6 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{n}</span>
                <p className="mt-4 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-slate-500">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} {org?.name ?? "HRMS"}. We process your information under the Data Privacy Act of 2012 (RA 10173).</p>
          {!me && <Link href="/careers/login" className="font-semibold text-brand hover:underline">Already applied? Sign in</Link>}
        </div>
      </footer>
    </div>
  );
}
