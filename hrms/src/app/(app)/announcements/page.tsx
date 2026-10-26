import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AnnouncementForm, ArchiveAnnouncementButton, RestoreAnnouncementButton } from "./AnnouncementForms";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const me = await requireUser("/announcements");
  const settings = await getOrgSettings(me.organizationId);
  const archived = (await searchParams).view === "archived";
  const items = await prisma.announcement.findMany({
    where: { organizationId: me.organizationId, archivedAt: archived ? { not: null } : null },
    orderBy: archived ? [{ archivedAt: "desc" }] : [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium" });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Announcements" subtitle="Messages for everyone. They show on each person's Home page and send a notification." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <nav aria-label="Announcement list" className="flex gap-2 text-sm">
            {[{ label: "Current", href: "/announcements", on: !archived }, { label: "Archived", href: "/announcements?view=archived", on: archived }].map((t) => (
              <Link key={t.label} href={t.href} aria-current={t.on ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${t.on ? "bg-brand text-brand-ink" : "border border-line text-muted hover:bg-bg"}`}>{t.label}</Link>
            ))}
          </nav>
          {items.length === 0 ? <EmptyState title={archived ? "No archived announcements" : "No announcements"} hint={archived ? "Archived announcements are kept here and can be restored." : "Post the first one."} /> : (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {items.map((a) => (
                  <li key={a.id} className={`px-5 py-4 ${archived ? "bg-bg/60 text-muted" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{a.title} {a.pinned && <Badge tone="brand">Pinned</Badge>}</p>
                      <span className="flex items-center gap-2 text-xs text-muted">{when.format(a.createdAt)} {archived ? <RestoreAnnouncementButton id={a.id} title={a.title} /> : <ArchiveAnnouncementButton id={a.id} title={a.title} />}</span>
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
