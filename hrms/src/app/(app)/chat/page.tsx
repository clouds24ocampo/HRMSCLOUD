import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { myConversations } from "@/lib/chat";
import { Badge, Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { openDirect } from "./actions";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser("/chat");
  const q = ((await searchParams).q ?? "").trim();
  const [chats, people] = await Promise.all([
    myConversations(me.id, me.organizationId),
    prisma.user.findMany({
      where: { organizationId: me.organizationId, active: true, id: { not: me.id }, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
      select: { id: true, name: true, role: { select: { name: true } }, employee: { select: { position: { select: { title: true } }, department: { select: { name: true } } } } },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Chat" subtitle="Messages, voice and video calls with anyone in your organization." />
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <Card className="p-0">
          <h2 className="px-5 pt-5 text-lg font-semibold">Conversations</h2>
          {chats.length === 0 ? (
            <div className="p-5"><EmptyState title="No conversations yet" hint="Pick someone on the right to start." /></div>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {chats.map((c) => (
                <li key={c.id}>
                  <Link href={`/chat/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-bg">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-sm text-muted">{c.last ? `${c.last.senderId === me.id ? "You: " : ""}${c.last.body}` : "No messages yet"}</span>
                    </span>
                    {c.unread > 0 && <Badge tone="danger">{c.unread}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit space-y-3">
          <h2 className="font-semibold">New message</h2>
          <form role="search">
            <input name="q" defaultValue={q} placeholder="Search people" aria-label="Search people" className={`${inputClass} mt-0`} />
          </form>
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {people.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.employee?.position?.title ?? p.role.name}{p.employee?.department ? ` · ${p.employee.department.name}` : ""}</span>
                </span>
                <form action={openDirect.bind(null, p.id)}>
                  <button className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg" aria-label={`Message ${p.name}`}>Message</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
