import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AnnouncementForm, ArchiveAnnouncementButton } from "./AnnouncementForms";

export default async function AnnouncementsPage() {
  const me = await requireUser("/announcements");
  const settings = await getOrgSettings(me.organizationId);
  const items = await prisma.announcement.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 50 });
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium" });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Announcements" subtitle="Messages for everyone. They show on each person's Home page and send a notification." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {items.length === 0 ? <EmptyState title="No announcements" hint="Post the first one." /> : (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {items.map((a) => (
                  <li key={a.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{a.title} {a.pinned && <Badge tone="brand">Pinned</Badge>}</p>
                      <span className="flex items-center gap-2 text-xs text-muted">{when.format(a.createdAt)} <ArchiveAnnouncementButton id={a.id} title={a.title} /></span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">New announcement</h2>
          <AnnouncementForm />
        </Card>
      </div>
    </div>
  );
}
