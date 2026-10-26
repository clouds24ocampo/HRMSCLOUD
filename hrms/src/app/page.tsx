import { Icon, ICON_INLINE } from "@/components/Icon";
import Image from "next/image";
import Link from "next/link";
import { SculptureHero } from "@/components/ui/liquid-sculpture-hero";
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

export default async function Landing() {
  await redirectIfSignedIn();
  const open = await registrationOpen();
  return (
    <div className="min-h-dvh bg-[#111110] text-halo">
      <SculptureHero
        theme="dark"
        darkBackground="#111110"
        src="/hero/sculpture-light.webp"
        darkSrc="/hero/sculpture-dark.webp"
        mobileSrc="/hero/sculpture-light-mobile.webp"
        mobileDarkSrc="/hero/sculpture-dark-mobile.webp"
        imageAlt="Abstract sculpture of interwoven metallic filaments and particles"
        brand="HRMS"
        navLinks={[
          { label: "Time stamp", href: "/login?stamp=1" },
          { label: "How it works", href: open ? "#how" : "#industries" },
          { label: "Industries", href: "#industries" },
        ]}
        navCta={{ label: "Sign in", href: "/login" }}
        eyebrow="Attendance · Payroll · Projects"
        headline={"Your whole team,\nin one clear place."}
        headlineAccent="in one clear place."
        body="Time stamps, schedules, payroll and project boards for your whole organization. Accurate to the minute, and ready on any phone."
        primaryCta={open ? { label: "Register your organization", href: "/register" } : { label: "Sign in to workspace", href: "/login" }}
        secondaryCta={open ? { label: "I already have an account", href: "/login" } : { label: "Time stamp", href: "/login?stamp=1" }}
        hint="Move across the form"
        hintTouch="Touch the form"
      />

      {open && (
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
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

      <section id="industries" className="mx-auto max-w-6xl px-6 pb-20 pt-20">
        <h2 className="font-headline text-2xl font-medium tracking-tight sm:text-3xl">Made for organizations like yours</h2>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {CATEGORIES.map((c) => (
            <li
              key={c.key}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-halo/85 backdrop-blur-xl"
            >
              <Icon name={c.icon} className={ICON_INLINE} /> {c.name}
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
