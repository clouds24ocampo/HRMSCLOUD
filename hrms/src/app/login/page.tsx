import Link from "next/link";
import { LoginShell } from "./LoginShell";
import { SculptureHero } from "@/components/ui/liquid-sculpture-hero";
import { Logo } from "@/components/Logo";
import { redirectIfSignedIn } from "@/lib/auth";
import { registrationOpen } from "@/lib/registration";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ stamp?: string }> }) {
  await redirectIfSignedIn();
  const open = await registrationOpen();
  const { stamp } = await searchParams; // /login?stamp=1 opens on the time stamp tab: a handy phone shortcut
  return (
    <LoginShell
      startOnStamp={stamp === "1"}
      top={
        <>
          <Link href="/" className="mb-10 flex items-center gap-2 font-headline text-lg font-medium text-brand">
            <Logo className="h-6 w-6" /> HRMS
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 mb-6 text-muted">Sign in to your HR workspace, or just time stamp.</p>
        </>
      }
      bottom={
        <>
          <p className="mt-4 text-center text-xs text-muted">Employees: use the email and temporary password from your administrator.</p>
          {open && (
            <p className="mt-6 text-center text-sm text-muted">
              New here?{" "}
              <Link href="/register" className="font-semibold text-brand hover:underline">
                Register your organization
              </Link>
            </p>
          )}
        </>
      }
      hero={
        <SculptureHero
          theme="dark"
          themeToggle={false}
          height="100%"
          darkBackground="#111110"
          src="/hero/sculpture-light.webp"
          darkSrc="/hero/sculpture-dark.webp"
          mobileSrc="/hero/sculpture-light-mobile.webp"
          mobileDarkSrc="/hero/sculpture-dark-mobile.webp"
          brand="HRMS"
          brandHref="/"
          navLinks={[]}
          navCta={{ label: "Back to home", href: "/" }}
          eyebrow="Sign in or time stamp"
          headline={"People first.\nEverything else follows."}
          headlineAccent="Everything else follows."
          body=""
          primaryCta={null}
          secondaryCta={null}
          hint="Move across the form"
          hintTouch="Touch the form"
        />
      }
    />
  );
}
