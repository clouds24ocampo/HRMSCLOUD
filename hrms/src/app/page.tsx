import Image from "next/image";
import Link from "next/link";
import { HeroScene } from "@/components/HeroScene";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { Spotlight } from "@/components/Spotlight";
import { CATEGORIES } from "@/lib/industries";
import { redirectIfSignedIn } from "@/lib/auth";
import { registrationOpen } from "@/lib/registration";

const STEPS = [
  { t: "Choose your industry", d: "Ten categories, from local governments to call centers." },
  { t: "Set your size", d: "From under 20 people to over 1,000." },
  { t: "Create your account", d: "You become the Super Admin of your organization." },
];

// Logos from svgl.app.
const BUILT_WITH = [
  { src: "/logos/nextjs_icon_dark.svg", name: "Next.js" },
  { src: "/logos/react_dark.svg", name: "React" },
  { src: "/logos/typescript.svg", name: "TypeScript" },
  { src: "/logos/postgresql.svg", name: "PostgreSQL" },
];

const glassButton = "rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium backdrop-blur-xl transition hover:bg-white/10";

export default async function Landing() {
  await redirectIfSignedIn();
  const open = await registrationOpen();
  return (
    <div className="min-h-dvh bg-void text-halo">
      <section className="relative isolate min-h-dvh overflow-hidden select-none bg-[radial-gradient(60%_55%_at_72%_40%,rgba(99,102,241,0.22),transparent),radial-gradient(40%_40%_at_8%_95%,rgba(232,121,249,0.10),transparent)]">
        <HeroScene className="absolute inset-0 -z-10 opacity-80 md:opacity-100" />
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-void/80 via-void/30 to-transparent md:from-void/60" aria-hidden />

        <header className="mx-auto mt-4 flex max-w-5xl items-center justify-between rounded-full border border-white/10 bg-white/5 py-2 pr-2 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">
          <span className="flex items-center gap-2 font-headline text-lg font-medium">
            <Logo className="h-6 w-6 text-photon" /> HRMS
          </span>
          <Link href="/login" className={glassButton}>Sign in</Link>
        </header>

        <p className="absolute right-6 bottom-6 text-sm text-halo/50">Press and drag to pull the particles</p>

        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl items-center px-6 pb-16">
          <div className="max-w-2xl">
            <Reveal delay={1.0}>
              <h1 className="font-headline text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl">
                Every person in your organization, in one clear place.
              </h1>
            </Reveal>
            <Reveal delay={1.25}>
              <p className="mt-6 max-w-md text-lg text-halo/75">
                Set up your people and structure first. Attendance, leave and payroll come next.
              </p>
            </Reveal>
            <Reveal delay={1.5} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={open ? "/register" : "/login"}
                className="rounded-full bg-halo px-7 py-3.5 text-center font-semibold text-void shadow-[0_0_40px_-4px_rgba(143,162,255,0.7)] transition hover:scale-[1.03] hover:shadow-[0_0_56px_0_rgba(143,162,255,0.9)] active:scale-95"
              >
                {open ? "Register your organization" : "Sign in to workspace"}
              </Link>
              {open && (
                <Link href="/login" className={`${glassButton} px-7 py-3.5 text-center text-base`}>
                  I already have an account
                </Link>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {open && (
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-headline text-2xl font-medium tracking-tight sm:text-3xl">How registration works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <Spotlight className="h-full p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-photon/40 text-sm font-semibold text-photon">
                  {i + 1}
                </span>
                <p className="mt-5 text-lg font-semibold">{s.t}</p>
                <p className="mt-1 text-halo/65">{s.d}</p>
              </Spotlight>
            </li>
          ))}
        </ol>
      </section>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-headline text-2xl font-medium tracking-tight sm:text-3xl">Made for organizations like yours</h2>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {CATEGORIES.map((c) => (
            <li
              key={c.key}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-halo/85 backdrop-blur-xl"
            >
              <span aria-hidden>{c.icon}</span> {c.name}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <span className="text-sm text-halo/60">Built with</span>
            {BUILT_WITH.map((l) => (
              <Image key={l.name} src={l.src} alt={l.name} width={28} height={28} unoptimized className="h-7 w-7 object-contain opacity-80" />
            ))}
          </div>
          <Link href={open ? "/register" : "/login"} className="text-sm font-medium text-photon hover:underline">
            {open ? "Register your organization" : "Sign in"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
