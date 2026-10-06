import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { MENU, MOBILE_PRIMARY } from "@/lib/menu";
import { Nav } from "@/components/Nav";
import { AutoRefresh } from "@/components/AutoRefresh";
import { logout } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const unread = await prisma.notification.count({ where: { userId: user.id, organizationId: user.organizationId, readAt: null } });
  const groups = MENU.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(user.role.key, i.href)) })).filter((g) => g.items.length);

  return (
    <div className="flex min-h-dvh">
      <Nav groups={groups} primary={MOBILE_PRIMARY} />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.organization.name} · {user.role.name}</p>
          </div>
          <div className="flex items-center gap-2">
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
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
        <AutoRefresh />
      </div>
    </div>
  );
}
