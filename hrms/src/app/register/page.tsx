import Link from "next/link";
import { RegisterWizard } from "./RegisterWizard";
import { HeroScene } from "@/components/HeroScene";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { redirectIfSignedIn } from "@/lib/auth";
import { registrationOpen } from "@/lib/registration";

export default async function RegisterPage() {
  await redirectIfSignedIn();
  if (!(await registrationOpen())) redirect("/login");
  return (
    <div className="theme-quantum relative isolate min-h-dvh overflow-x-clip bg-void bg-[radial-gradient(60%_50%_at_50%_30%,rgba(99,102,241,0.2),transparent),radial-gradient(40%_40%_at_90%_95%,rgba(232,121,249,0.10),transparent)] px-4 py-6 sm:px-8">
      <HeroScene className="pointer-events-none absolute inset-0 -z-10 opacity-50" />
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between rounded-full border border-white/10 bg-white/5 py-2 pr-2 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 font-headline text-lg font-medium">
          <Logo className="h-6 w-6 text-photon" /> HRMS
        </Link>
        <Link href="/login" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10">
          Sign in
        </Link>
      </header>
      <main className="pb-10">
        <RegisterWizard />
      </main>
    </div>
  );
}
