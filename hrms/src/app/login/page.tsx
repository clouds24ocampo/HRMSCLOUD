import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { HeroScene } from "@/components/HeroScene";
import { Logo } from "@/components/Logo";
import { redirectIfSignedIn } from "@/lib/auth";

export default async function LoginPage() {
  await redirectIfSignedIn();
  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2 font-headline text-lg font-medium text-brand">
            <Logo className="h-6 w-6" /> HRMS
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 mb-8 text-muted">Sign in to your HR workspace.</p>
          <LoginForm />
          <p className="mt-4 text-center text-xs text-muted">Employees: use the email and temporary password from your administrator.</p>
          <p className="mt-6 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/register" className="font-semibold text-brand hover:underline">
              Register your organization
            </Link>
          </p>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-void bg-[radial-gradient(60%_55%_at_50%_45%,rgba(99,102,241,0.25),transparent)] md:block">
        <HeroScene className="absolute inset-0" />
        <p className="absolute inset-x-0 bottom-10 px-10 text-center font-headline text-lg font-medium text-halo/80">
          People first. Everything else follows.
        </p>
      </section>
    </main>
  );
}
