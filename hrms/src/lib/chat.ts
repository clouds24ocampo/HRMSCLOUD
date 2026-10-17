// Chat lists for the Chat page and the unread count in the header.
import { prisma } from "@/lib/prisma";

export async function myConversations(userId: string, organizationId: string) {
  const rows = await prisma.conversationMember.findMany({
    where: { userId, conversation: { organizationId } },
    include: {
      conversation: {
        include: {
          members: { where: { userId: { not: userId } }, include: { user: { select: { id: true, name: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
  });
  const unread = await Promise.all(rows.map((r) => prisma.message.count({ where: { conversationId: r.conversationId, senderId: { not: userId }, createdAt: { gt: r.lastReadAt } } })));
  return rows.map((r, i) => ({
    id: r.conversationId,
    name: r.conversation.name ?? r.conversation.members.map((m) => m.user.name).join(", ") ?? "Chat",
    last: r.conversation.messages[0] ?? null,
    unread: unread[i],
  }));
}

export async function unreadMessages(userId: string) {
  const mem = await prisma.conversationMember.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } });
  if (!mem.length) return 0;
  return prisma.message.count({ where: { senderId: { not: userId }, OR: mem.map((m) => ({ conversationId: m.conversationId, createdAt: { gt: m.lastReadAt } })) } });
}
