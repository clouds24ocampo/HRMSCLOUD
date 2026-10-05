import Link from "next/link";
import { Logo } from "@/components/Logo";

// Shown when the database cannot be reached. Touches no data, so it works while the database is down.
export const dynamic = "force-static";

export default function Unavailable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <p className="mb-6 flex items-center justify-center gap-2 font-headline text-lg font-medium text-brand">
          <Logo className="h-6 w-6" /> HRMS
        </p>
        <h1 className="text-2xl font-bold tracking-tight">We cannot reach the database</h1>
        <p className="mt-3 text-muted">It is probably still starting, or Docker is not running. Nothing was lost.</p>
        <ol className="mx-auto mt-6 max-w-sm list-decimal space-y-2 pl-5 text-left text-sm">
          <li>Open Docker Desktop and wait until it says it is running.</li>
          <li>In the project folder, run <code className="rounded bg-line/60 px-1.5 py-0.5">npm run dev</code>. It starts the database for you.</li>
          <li>Press the button below.</li>
        </ol>
        <Link href="/" className="mt-8 inline-block rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-ink shadow-md shadow-brand/30 transition hover:brightness-110">
          Try again
        </Link>
      </div>
    </main>
  );
}
