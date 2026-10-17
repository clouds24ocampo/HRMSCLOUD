import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { fetchMessages } from "../actions";
import { CallButtons, ChatThread } from "../ChatThread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("/chat");
  const { id } = await params;
  const c = await prisma.conversation.findFirst({
    where: { id, organizationId: me.organizationId, members: { some: { userId: me.id } } },
    include: { members: { where: { userId: { not: me.id } }, include: { user: { select: { name: true } } } } },
  });
  if (!c) notFound();
  const initial = (await fetchMessages(c.id)) ?? [];
  const name = c.name ?? c.members.map((m) => m.user.name).join(", ");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/chat" className="text-sm font-medium text-muted hover:text-ink">← All chats</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        {c.directKey && <CallButtons conversationId={c.id} name={name} />}
      </div>
      <Card className="p-0">
        <ChatThread conversationId={c.id} initial={initial} />
      </Card>
      <p className="text-xs text-muted">Calls need camera and microphone permission and a secure (https) address. Audio and video go directly between the two devices.</p>
    </div>
  );
}
