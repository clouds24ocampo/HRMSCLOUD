import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { MENU, MOBILE_PRIMARY } from "@/lib/menu";
import { Nav } from "@/components/Nav";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CallManager } from "@/components/CallManager";
import { unreadMessages } from "@/lib/chat";
import { logout } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";
import { isHr } from "@/lib/scope";
import { load201 } from "@/lib/documents";
import { missing201 } from "@/lib/file201";
import { ensurePolicies, unsignedPolicies } from "@/lib/policies";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const unread = await prisma.notification.count({ where: { userId: user.id, organizationId: user.organizationId, readAt: null } });
  // The 201 file is mandatory for employees: until every required document is in, a reminder sits on every page.
  const emp = isHr(user.role.key) ? null : await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } });
  const missing = emp && canAccess(user.role.key, "/documents") ? missing201((await load201(user.organizationId, [emp.id])).get(emp.id)?.keys() ?? []).length : 0;
  // Policies to sign: the same reminder, for everyone with an employee profile (HR signs too).
  await ensurePolicies(user.organizationId, user.organization.name);
  const me = emp ?? (await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } }));
  const toSign = me ? (await unsignedPolicies(user.organizationId, me.id)).length : 0;
  const unreadChat = await unreadMessages(user.id);
  const groups = MENU.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(user.role.key, i.href)) })).filter((g) => g.items.length);
  const mobilePrimary = canAccess(user.role.key, "/leave") ? MOBILE_PRIMARY : ["/dashboard", "/dtr", "/schedule", "/payslips"];

  return (
    <div className="flex min-h-dvh">
      <Nav groups={groups} primary={mobilePrimary} />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.organization.name} · {user.role.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/chat" aria-label={unreadChat ? `Chat, ${unreadChat} unread` : "Chat"} className="relative rounded-lg px-2.5 py-1.5 text-lg transition hover:bg-bg">
              <span aria-hidden>💬</span>
              {unreadChat > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unreadChat > 9 ? "9+" : unreadChat}</span>}
            </Link>
            <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative rounded-lg px-2.5 py-1.5 text-lg transition hover:bg-bg">
              <span aria-hidden>🔔</span>
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <Link href="/change-password" className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink sm:block">
              Change password
            </Link>
            <form action={logout}>
              <button className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">
                Sign out
              </button>
            </form>
          </div>
        </header>
        {missing > 0 && (
          <aside aria-label="201 file reminder" className="print:hidden flex flex-wrap items-center justify-between gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2.5 text-sm sm:px-8">
            <span><span className="font-semibold text-danger">Your 201 file is incomplete.</span> {missing} required document{missing === 1 ? " is" : "s are"} still missing.</span>
            <Link href="/documents#file201" className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-white transition active:scale-95">Upload now</Link>
          </aside>
        )}
        {toSign > 0 && (
          <aside aria-label="Policies reminder" className="print:hidden flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm sm:px-8">
            <span><span className="font-semibold text-warning">{toSign} {toSign === 1 ? "policy" : "policies"} to read and sign.</span> User agreement, terms and privacy policies.</span>
            <Link href="/policies" className="rounded-lg border border-warning/50 px-3 py-1.5 font-semibold text-warning transition hover:bg-warning/10">Open policies</Link>
          </aside>
        )}
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
        <AutoRefresh />
        <CallManager />
      </div>
    </div>
  );
}
