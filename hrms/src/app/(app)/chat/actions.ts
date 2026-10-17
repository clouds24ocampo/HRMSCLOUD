"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";

// Chat and calls stay inside one organization. Every action checks that the caller is a member of the conversation.
type Me = Awaited<ReturnType<typeof requireUser>>;

async function member(me: Me, conversationId: string) {
  return prisma.conversationMember.findFirst({ where: { conversationId, userId: me.id, conversation: { organizationId: me.organizationId } } });
}

// Opens (or creates) the one-to-one chat with a colleague.
export async function openDirect(userId: string) {
  const me = await requireUser("/chat");
  if (userId === me.id) redirect("/chat");
  const other = await prisma.user.findFirst({ where: { id: userId, organizationId: me.organizationId, active: true }, select: { id: true } });
  if (!other) redirect("/chat");
  const directKey = [me.id, other.id].sort().join(":");
  const c = await prisma.conversation.upsert({
    where: { directKey },
    update: {},
    create: { organizationId: me.organizationId, directKey, members: { create: [{ userId: me.id }, { userId: other.id }] } },
  });
  redirect(`/chat/${c.id}`);
}

export type ChatMessage = { id: string; body: string; at: string; mine: boolean; sender: string };

export async function sendMessage(conversationId: string, body: string): Promise<{ error?: string; message?: ChatMessage }> {
  const me = await requireUser("/chat");
  const text = z.string().trim().min(1).max(4000).safeParse(body);
  if (!text.success) return { error: "Write a message (up to 4,000 characters)." };
  if (!(await member(me, conversationId))) return { error: "You are not in this conversation." };
  const m = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({ data: { conversationId, senderId: me.id, body: text.data } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.createdAt } });
    await tx.conversationMember.updateMany({ where: { conversationId, userId: me.id }, data: { lastReadAt: msg.createdAt } });
    return msg;
  });
  return { message: { id: m.id, body: m.body, at: m.createdAt.toISOString(), mine: true, sender: me.name } };
}

// New messages since `after` (an ISO time), oldest first. Reading them marks the conversation read.
export async function fetchMessages(conversationId: string, after?: string): Promise<ChatMessage[] | null> {
  const me = await requireUser("/chat");
  if (!(await member(me, conversationId))) return null;
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : undefined;
  const rows = await prisma.message.findMany({
    where: { conversationId, ...(since ? { createdAt: { gt: since } } : {}) },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: since ? "asc" : "desc" },
    take: 200,
  });
  const list = since ? rows : rows.reverse();
  if (list.length) await prisma.conversationMember.updateMany({ where: { conversationId, userId: me.id }, data: { lastReadAt: new Date() } });
  return list.map((m) => ({ id: m.id, body: m.body, at: m.createdAt.toISOString(), mine: m.senderId === me.id, sender: m.sender.name }));
}

// ───────────── Calls (WebRTC signalling) ─────────────
// The browsers gather their network candidates before sending, so one offer and one answer are all the server relays.

const sdp = z.string().min(20).max(100_000);
const RING_MS = 45_000;

export async function startCall(conversationId: string, kind: "VOICE" | "VIDEO", offer: string): Promise<{ id?: string; error?: string }> {
  const me = await requireUser("/chat");
  if (!sdp.safeParse(offer).success || (kind !== "VOICE" && kind !== "VIDEO")) return { error: "The call could not be set up." };
  if (!(await member(me, conversationId))) return { error: "You are not in this conversation." };
  const other = await prisma.conversationMember.findFirst({ where: { conversationId, userId: { not: me.id } }, select: { userId: true } });
  if (!other) return { error: "Nobody to call in this conversation." };
  const busy = await prisma.callSession.findFirst({ where: { OR: [{ callerId: other.userId }, { calleeId: other.userId }], status: { in: ["RINGING", "ACTIVE"] }, createdAt: { gt: new Date(Date.now() - 4 * 3600_000) } } });
  if (busy) return { error: "They are on another call. Try again later." };
  const c = await prisma.callSession.create({ data: { organizationId: me.organizationId, conversationId, callerId: me.id, calleeId: other.userId, kind, offer } });
  await audit(me.id, kind === "VIDEO" ? "call.video_started" : "call.voice_started", "CallSession", c.id, { conversationId }, me.organizationId);
  return { id: c.id };
}

export type IncomingCall = { id: string; kind: "VOICE" | "VIDEO"; caller: string; offer: string; conversationId: string };

// Polled by every open page: is someone calling me? Calls nobody answered in time become missed.
export async function pollIncoming(): Promise<IncomingCall | null> {
  const me = await requireUser("/chat");
  await prisma.callSession.updateMany({ where: { calleeId: me.id, status: "RINGING", createdAt: { lt: new Date(Date.now() - RING_MS) } }, data: { status: "MISSED", endedAt: new Date() } });
  const c = await prisma.callSession.findFirst({ where: { calleeId: me.id, status: "RINGING", organizationId: me.organizationId }, orderBy: { createdAt: "desc" } });
  if (!c?.offer) return null;
  const caller = await prisma.user.findUnique({ where: { id: c.callerId }, select: { name: true } });
  return { id: c.id, kind: c.kind, caller: caller?.name ?? "Someone", offer: c.offer, conversationId: c.conversationId };
}

async function myCall(me: Me, id: string) {
  return prisma.callSession.findFirst({ where: { id, organizationId: me.organizationId, OR: [{ callerId: me.id }, { calleeId: me.id }] } });
}

export async function callState(id: string): Promise<{ status: string; answer: string | null } | null> {
  const me = await requireUser("/chat");
  const c = await myCall(me, id);
  if (!c) return null;
  if (c.status === "RINGING" && c.createdAt.getTime() < Date.now() - RING_MS) {
    await prisma.callSession.update({ where: { id }, data: { status: "MISSED", endedAt: new Date() } });
    return { status: "MISSED", answer: null };
  }
  return { status: c.status, answer: c.callerId === me.id ? c.answer : null };
}

export async function answerCall(id: string, answer: string): Promise<{ error?: string }> {
  const me = await requireUser("/chat");
  if (!sdp.safeParse(answer).success) return { error: "The call could not be set up." };
  const n = await prisma.callSession.updateMany({ where: { id, calleeId: me.id, status: "RINGING" }, data: { status: "ACTIVE", answer, answeredAt: new Date() } });
  return n.count ? {} : { error: "The call has ended." };
}

export async function endCall(id: string, decline = false) {
  const me = await requireUser("/chat");
  const c = await myCall(me, id);
  if (!c || c.status === "ENDED" || c.status === "DECLINED" || c.status === "MISSED") return;
  await prisma.callSession.update({ where: { id }, data: { status: decline && c.status === "RINGING" ? "DECLINED" : "ENDED", endedAt: new Date() } });
}
