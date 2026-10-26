import { formatDay, formatTime, keyOfDbDate } from "@/lib/time";
import { dayKey } from "@/lib/time";
import { Badge } from "@/components/ui";
import { CATEGORY_COLOR, CATEGORY_LABEL, cardProgress, personName as fullName } from "@/lib/worksync";
import { cardContributors, type RCard } from "@/lib/worksync-report";
import { archiveCard, removeCheck, toggleAssignee, toggleCheck, toggleLabel } from "./actions";
import { CheckForm, CommentForm, EditCardForm, MoveForm, NewLabelForm, QuickStatus } from "./CardForms";
import { AwardIncentiveForm } from "@/app/(app)/incentives/IncentiveForms";
import { Bar, Facepile, LabelChip } from "./parts";
import type { ViewCtx } from "./views/types";

type Detail = {
  id: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  completedById: string | null;
  completedAt: Date | null;
  title: string;
  description: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  startDate: Date | null;
  dueDate: Date | null;
  listId: string;
  list: { name: string; category: "TODO" | "DOING" | "BLOCKED" | "DONE" };
  assignees: { employeeId: string }[];
  labels: { labelId: string }[];
  checklist: { id: string; text: string; done: boolean }[];
  comments: { id: string; authorId: string; body: string; createdAt: Date }[];
};

const when = (d: Date, tz: string) => `${formatDay(dayKey(d, tz), { month: "short", day: "numeric" })} ${formatTime(d, tz)}`;

const ICONS: Record<string, string> = {
  CARD_CREATED: "➕",
  EDITED: "✏️",
  MOVED: "🔄",
  DONE: "✅",
  BLOCKED: "⚠️",
  ASSIGNED: "👤",
  CHECKED: "☑️",
  COMMENTED: "💬",
  ARCHIVED: "📦",
};

// The card, opened over the board: Trello's layout. Main column on the left (details, checklist, comments), actions on the right.
export function CardDetail({ ctx, card, who, activity, events }: { ctx: ViewCtx; card: Detail; who: Map<string, string>; activity: { id: string; actorId: string; type: string; detail: string | null; createdAt: Date }[]; events: { actorId: string; type: string; detail: string | null; createdAt: Date; cardId: string | null }[] }) {
  const done = card.checklist.filter((k) => k.done).length;
  const pct = cardProgress({ category: card.list.category, checkDone: done, checkTotal: card.checklist.length });
  const workers = ctx.members.filter((m) => m.role !== "VIEWER");
  const mine = new Set(card.assignees.map((a) => a.employeeId));
  const onCard = ctx.members.filter((m) => mine.has(m.employeeId));
  const cardLabels = ctx.labels.filter((l) => card.labels.some((x) => x.labelId === l.id));
  const edit = ctx.canEdit;
  const closeHref = ctx.href({ card: null, panel: null });
  const assigneeKeys = card.assignees.map((a) => ctx.members.find((m) => m.employeeId === a.employeeId)?.userId ?? `e:${a.employeeId}`);
  const rcard: RCard = { id: card.id, projectId: ctx.projectId, title: card.title, listName: card.list.name, category: card.list.category, createdById: card.createdById, createdAt: card.createdAt, completedById: card.completedById, completedAt: card.completedAt, dueDay: card.dueDate ? keyOfDbDate(card.dueDate) : null, progress: pct, assigneeKeys };
  const contributors = cardContributors(rcard, events.map((e) => ({ ...e, cardId: card.id }))).filter((c) => c.actions > 0 || c.assigned);
  const resolved = card.list.category === "DONE" && card.completedAt;
  const nameOf = (k: string) => { const m = ctx.members.find((x) => x.userId === k); return who.get(k) ?? (m ? fullName(m) : "a former user"); };
  const lastModifier = events.find((e) => e.actorId && e.type !== "CARD_CREATED");
  const lastModifiedBy = lastModifier ? nameOf(lastModifier.actorId) : nameOf(card.createdById);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0 space-y-6">
        <header className="pr-8">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">in list <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: CATEGORY_COLOR[card.list.category] }}>{card.list.name}</span><span className="text-xs">· {CATEGORY_LABEL[card.list.category]}</span></p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>Created by <span className="font-semibold text-ink">{who.get(card.createdById) ?? "a former user"}</span> · {when(card.createdAt, ctx.tz)}</span>
            {card.updatedAt && card.updatedAt.getTime() - card.createdAt.getTime() > 1000 && (
              <span className="rounded bg-bg px-2 py-0.5">Last modified by <span className="font-semibold text-ink">{lastModifiedBy}</span> · {when(card.updatedAt, ctx.tz)}</span>
            )}
          </p>
          {!edit && <h2 className="mt-1 text-2xl font-bold">{card.title}</h2>}
        </header>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {cardLabels.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Labels</p><div className="flex flex-wrap gap-1">{cardLabels.map((l) => <LabelChip key={l.id} label={l} />)}</div></div>}
          {onCard.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Members</p><div className="flex items-center gap-2"><Facepile people={onCard} size={28} max={6} /><span className="text-muted">{onCard.map(fullName).join(", ")}</span></div></div>}
          {(card.startDate || card.dueDate) && <div><p className="mb-1 text-xs font-semibold text-muted">Dates</p><p>{card.startDate ? formatDay(keyOfDbDate(card.startDate), { month: "short", day: "numeric" }) : "…"} → {card.dueDate ? formatDay(keyOfDbDate(card.dueDate), { month: "short", day: "numeric", year: "numeric" }) : "…"}</p></div>}
        </div>

        <section aria-label="Card report" className="rounded-xl border border-line bg-bg/50 p-4 text-sm">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Card Audit & Progress</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div><dt className="text-xs text-muted">Created by</dt><dd className="font-semibold">{nameOf(card.createdById)}</dd><dd className="text-xs text-muted">{when(card.createdAt, ctx.tz)}</dd></div>
            <div><dt className="text-xs text-muted">Last modified</dt><dd className="font-semibold">{lastModifiedBy}</dd><dd className="text-xs text-muted">{when(card.updatedAt, ctx.tz)}</dd></div>
            <div><dt className="text-xs text-muted">Resolved by</dt>{resolved ? <><dd className="font-semibold">{card.completedById ? nameOf(card.completedById) : "—"}</dd><dd className="text-xs text-muted">{when(card.completedAt!, ctx.tz)}</dd></> : <dd className="text-muted">Not yet</dd>}</div>
            <div><dt className="text-xs text-muted">Progress</dt><dd className="font-semibold tabular-nums">{pct}%</dd></div>
          </dl>
          <div className="mt-3">
            <p className="mb-1 text-xs text-muted">Worked on by</p>
            {contributors.length === 0 ? <p className="text-muted">Nobody yet.</p> : (
              <ul className="flex flex-wrap gap-2">
                {contributors.map((c) => (
                  <li key={c.actorId} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs" title={`${c.actions} actions${c.comments ? `, ${c.comments} comments` : ""}`}>
                    <span className="font-semibold">{nameOf(c.actorId)}</span>
                    <span className="text-muted">{[c.created && "added", c.resolved && "resolved", c.assigned && "assigned", c.actions > 0 && `${c.actions} ${c.actions === 1 ? "action" : "actions"}`].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {edit ? (
          <EditCardForm cardId={card.id} closeHref={closeHref} card={{ title: card.title, description: card.description ?? "", priority: card.priority, startDay: card.startDate ? keyOfDbDate(card.startDate) : "", dueDay: card.dueDate ? keyOfDbDate(card.dueDate) : "" }} />
        ) : card.description ? <p className="whitespace-pre-line text-sm">{card.description}</p> : null}

        <section aria-label="Checklist">
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-sm font-bold">Checklist</h3>
            {card.checklist.length > 0 && <><span className="w-9 text-xs tabular-nums text-muted">{Math.round((done / card.checklist.length) * 100)}%</span><Bar percent={Math.round((done / card.checklist.length) * 100)} color="#22c55e" className="max-w-xs flex-1" /></>}
          </div>
          <ul className="space-y-0.5">
            {card.checklist.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-sm hover:bg-bg">
                {edit ? (
                  <form action={toggleCheck.bind(null, k.id)} className="min-w-0 flex-1"><button aria-pressed={k.done} className="flex w-full items-center gap-2 text-left"><span aria-hidden>{k.done ? "☑" : "☐"}</span><span className={k.done ? "text-muted line-through" : ""}>{k.text}</span></button></form>
                ) : <span className={k.done ? "text-muted line-through" : ""}>{k.done ? "☑" : "☐"} {k.text}</span>}
                {edit && <form action={removeCheck.bind(null, k.id)}><button aria-label={`Remove step ${k.text}`} className="px-1 text-muted hover:text-danger">×</button></form>}
              </li>
            ))}
            {card.checklist.length === 0 && <li className="text-sm text-muted">No steps yet. Break the work into steps to see its progress.</li>}
          </ul>
          {edit && <div className="mt-2"><CheckForm cardId={card.id} /></div>}
          <p className="mt-1 text-xs text-muted">Card progress: {pct}%{card.list.category === "DONE" ? " (finished)" : ""}</p>
        </section>

        <section aria-label="Comments and activity">
          <h3 className="mb-2 text-sm font-bold">Comments and activity</h3>
          <CommentForm cardId={card.id} />
          <ul className="mt-4 space-y-3">
            {[...card.comments.map((c) => ({ kind: "c" as const, at: c.createdAt, id: c.id, c })), ...activity.map((a) => ({ kind: "a" as const, at: a.createdAt, id: a.id, a }))]
              .sort((x, y) => y.at.getTime() - x.at.getTime())
              .map((e) => e.kind === "c" ? (
                <li key={e.id} className="rounded-xl bg-bg p-3 text-sm">
                  <p className="mb-0.5 text-xs text-muted"><span className="font-semibold text-ink">{who.get(e.c.authorId) ?? "Former user"}</span> · {when(e.c.createdAt, ctx.tz)}</p>
                  <p className="whitespace-pre-line">{e.c.body}</p>
                </li>
              ) : (
                <li key={e.id} className="flex items-start gap-2.5 rounded-lg border border-line/60 bg-bg/40 px-3 py-2 text-xs text-muted">
                  <span className="text-sm shrink-0" aria-hidden>{ICONS[e.a.type] ?? "📝"}</span>
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-semibold text-ink">{who.get(e.a.actorId) ?? "Former user"}</span>{" "}
                      <span className="font-medium text-ink/80">{e.a.type.toLowerCase().replace(/_/g, " ")}</span>
                      {e.a.detail ? <span className="text-muted">: {e.a.detail}</span> : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{when(e.a.createdAt, ctx.tz)}</p>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-4 text-sm" aria-label="Card actions">
        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Members</h3>
          <ul className="space-y-1">
            {workers.map((m) => {
              const on = mine.has(m.employeeId);
              return (
                <li key={m.employeeId}>
                  {edit ? (
                    <form action={toggleAssignee.bind(null, card.id, m.employeeId)}>
                      <button aria-pressed={on} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${on ? "bg-brand/10 font-semibold text-brand" : "hover:bg-bg"}`}>
                        <Facepile people={[m]} size={22} /><span className="min-w-0 flex-1 truncate">{fullName(m)}</span>{on && <span aria-hidden>✓</span>}
                      </button>
                    </form>
                  ) : on ? <Badge tone="brand">{fullName(m)}</Badge> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Labels</h3>
          <ul className="space-y-1">
            {ctx.labels.map((l) => {
              const on = card.labels.some((x) => x.labelId === l.id);
              return (
                <li key={l.id}>
                  {edit ? (
                    <form action={toggleLabel.bind(null, card.id, l.id)}><button aria-pressed={on} className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-bg"><span className="min-w-0 flex-1"><LabelChip label={l} /></span>{on && <span aria-hidden>✓</span>}</button></form>
                  ) : on ? <LabelChip label={l} /> : null}
                </li>
              );
            })}
          </ul>
          {edit && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-brand">Create a label</summary><div className="mt-2"><NewLabelForm projectId={ctx.projectId} /></div></details>}
        </section>

        {edit && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Status</h3>
            <QuickStatus cardId={card.id} current={card.list.category} closeHref={closeHref} />
          </section>
        )}

        {edit && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Move</h3>
            <MoveForm cardId={card.id} listId={card.listId} closeHref={closeHref}lists={ctx.lists.map((l) => ({ id: l.id, name: `${l.name} (${CATEGORY_LABEL[l.category]})` }))} />
          </section>
        )}

        {edit && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Award Incentive 🎁</h3>
            <p className="mb-2 text-xs text-muted">Grant an incentive bonus for this task.</p>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-amber-600 dark:text-amber-400 hover:underline">Award bonus to member…</summary>
              <div className="mt-2 text-ink">
                <AwardIncentiveForm
                  employees={workers.map((w) => ({ id: w.employeeId, name: fullName(w) }))}
                  prefilledEmployeeId={card.assignees[0]?.employeeId}
                  projectId={ctx.projectId}
                  cardId={card.id}
                />
              </div>
            </details>
          </section>
        )}

        {edit && <form action={archiveCard.bind(null, card.id)}><button className="w-full rounded-lg border border-line px-3 py-2 text-left font-medium text-danger transition hover:bg-danger/5">Archive card</button></form>}
      </aside>
    </div>
  );
}
