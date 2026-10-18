import { formatDay, formatTime, keyOfDbDate } from "@/lib/time";
import { dayKey } from "@/lib/time";
import { Badge } from "@/components/ui";
import { CATEGORY_COLOR, CATEGORY_LABEL, cardProgress, personName } from "@/lib/worksync";
import { archiveCard, removeCheck, toggleAssignee, toggleCheck, toggleLabel } from "./actions";
import { CheckForm, CommentForm, EditCardForm, MoveForm, NewLabelForm } from "./CardForms";
import { Bar, Facepile, LabelChip } from "./parts";
import type { ViewCtx } from "./views/types";

type Detail = {
  id: string;
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

// The card, opened over the board: Trello's layout. Main column on the left (details, checklist, comments), actions on the right.
export function CardDetail({ ctx, card, who, activity }: { ctx: ViewCtx; card: Detail; who: Map<string, string>; activity: { id: string; actorId: string; type: string; detail: string | null; createdAt: Date }[] }) {
  const done = card.checklist.filter((k) => k.done).length;
  const pct = cardProgress({ category: card.list.category, checkDone: done, checkTotal: card.checklist.length });
  const workers = ctx.members.filter((m) => m.role !== "VIEWER");
  const mine = new Set(card.assignees.map((a) => a.employeeId));
  const onCard = ctx.members.filter((m) => mine.has(m.employeeId));
  const cardLabels = ctx.labels.filter((l) => card.labels.some((x) => x.labelId === l.id));
  const edit = ctx.canEdit;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0 space-y-6">
        <header className="pr-8">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">in list <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: CATEGORY_COLOR[card.list.category] }}>{card.list.name}</span><span className="text-xs">· {CATEGORY_LABEL[card.list.category]}</span></p>
          {!edit && <h2 className="mt-1 text-2xl font-bold">{card.title}</h2>}
        </header>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {cardLabels.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Labels</p><div className="flex flex-wrap gap-1">{cardLabels.map((l) => <LabelChip key={l.id} label={l} />)}</div></div>}
          {onCard.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Members</p><div className="flex items-center gap-2"><Facepile people={onCard} size={28} max={6} /><span className="text-muted">{onCard.map(personName).join(", ")}</span></div></div>}
          {(card.startDate || card.dueDate) && <div><p className="mb-1 text-xs font-semibold text-muted">Dates</p><p>{card.startDate ? formatDay(keyOfDbDate(card.startDate), { month: "short", day: "numeric" }) : "…"} → {card.dueDate ? formatDay(keyOfDbDate(card.dueDate), { month: "short", day: "numeric", year: "numeric" }) : "…"}</p></div>}
        </div>

        {edit ? (
          <EditCardForm cardId={card.id} card={{ title: card.title, description: card.description ?? "", priority: card.priority, startDay: card.startDate ? keyOfDbDate(card.startDate) : "", dueDay: card.dueDate ? keyOfDbDate(card.dueDate) : "" }} />
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
                <li key={e.id} className="text-xs text-muted"><span className="font-semibold text-ink">{who.get(e.a.actorId) ?? "Former user"}</span> {e.a.type.toLowerCase().replace(/_/g, " ")}{e.a.detail ? `: ${e.a.detail}` : ""} · {when(e.a.createdAt, ctx.tz)}</li>
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
                        <Facepile people={[m]} size={22} /><span className="min-w-0 flex-1 truncate">{personName(m)}</span>{on && <span aria-hidden>✓</span>}
                      </button>
                    </form>
                  ) : on ? <Badge tone="brand">{personName(m)}</Badge> : null}
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
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Move</h3>
            <MoveForm cardId={card.id} listId={card.listId} lists={ctx.lists.map((l) => ({ id: l.id, name: `${l.name} (${CATEGORY_LABEL[l.category]})` }))} />
          </section>
        )}

        {edit && <form action={archiveCard.bind(null, card.id)}><button className="w-full rounded-lg border border-line px-3 py-2 text-left font-medium text-danger transition hover:bg-danger/5">Archive card</button></form>}
      </aside>
    </div>
  );
}
