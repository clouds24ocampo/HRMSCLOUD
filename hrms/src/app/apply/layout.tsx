import Link from "next/link";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { logoutApplicant } from "@/app/careers/login/actions";

export default async function ApplyLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser("/apply");
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/apply" className="flex items-center gap-2 font-headline text-lg font-medium text-brand"><Logo className="h-6 w-6" /> {me.organization.name}</Link>
          <div className="flex items-center gap-3">
            <span className="hidden truncate text-sm text-muted sm:block">{me.name}</span>
            <form action={logoutApplicant}><button className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">{children}</main>
    </div>
  );
}
