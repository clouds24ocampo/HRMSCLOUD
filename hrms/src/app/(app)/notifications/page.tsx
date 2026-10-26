import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { markAllRead, markRead, openNotification } from "./actions";

export default async function NotificationsPage() {
  const me = await requireUser("/notifications");
  const settings = await getOrgSettings(me.organizationId);
  const items = await prisma.notification.findMany({
    where: { userId: me.id, organizationId: me.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" });
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Things that need you or changed for you."
        action={unread > 0 ? <form action={markAllRead}><button className={ghostClass}>Mark all as read</button></form> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title="Nothing yet" hint="Leave decisions, approvals waiting for you and payslips show up here." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 px-5 py-3 ${n.readAt ? "" : "bg-brand/5"}`}>
                <div className="min-w-0">
                  <p className={n.readAt ? "font-medium" : "font-semibold"}>{!n.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand" aria-label="unread" />}{n.title}</p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-muted">{when.format(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {n.href && <form action={openNotification.bind(null, n.id)}><button className={ghostClass}>Open</button></form>}
                  {!n.readAt && <form action={markRead.bind(null, n.id)}><button className={ghostClass}>Mark read</button></form>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
