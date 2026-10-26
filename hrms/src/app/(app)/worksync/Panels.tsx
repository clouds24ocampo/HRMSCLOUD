import type { IconName } from "@/components/Icon";
import Link from "next/link";
import { formatDay, formatTime, dayKey, keyOfDbDate } from "@/lib/time";
import { Badge } from "@/components/ui";
import { ROLE_LABEL, personName, type MemberRole } from "@/lib/worksync";
import { archiveProject, deleteLabel, removeMember } from "./actions";
import { AddMemberForm, NewLabelForm, ProjectSettingsForm } from "./CardForms";
import { Avatar, LabelChip } from "./parts";
import type { ViewCtx } from "./views/types";

export type PanelName = "people" | "labels" | "activity" | "settings";
export const PANELS: { key: PanelName; label: string; icon: IconName }[] = [
  { key: "people", label: "People", icon: "people" },
  { key: "labels", label: "Labels", icon: "tag" },
  { key: "activity", label: "Activity", icon: "history" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const EVENT: Record<string, string> = {
  CARD_CREATED: "added", MOVED: "moved", DONE: "finished", BLOCKED: "blocked", COMMENTED: "commented on", ASSIGNED: "changed assignees on", CHECKED: "updated the checklist of",
  EDITED: "edited", ARCHIVED: "archived", PROJECT_CREATED: "started the project", PROJECT_ARCHIVED: "archived the project", MEMBER_ADDED: "added", MEMBER_REMOVED: "removed", LIST_ADDED: "added the list",
};

export function PanelContent({ panel, ctx, project, members, people, activity, who }: {
  panel: PanelName;
  ctx: ViewCtx;
  project: { id: string; name: string; description: string | null; dueDate: Date | null; color: string; archivedAt: Date | null };
  members: { id: string; employeeId: string; role: MemberRole; employee: { firstName: string; lastName: string } }[];
  people: { id: string; name: string }[];
  activity: { id: string; actorId: string; cardId: string | null; cardTitle: string | null; type: string; detail: string | null; createdAt: Date }[];
  who: Map<string, string>;
}) {
  if (panel === "people") {
    return (
      <div className="space-y-5">
        <h2 className="pr-8 text-lg font-bold">People on this project <span className="font-normal text-muted">({members.length})</span></h2>
        <ul className="divide-y divide-line text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2">
              <span className="flex min-w-0 items-center gap-2"><Avatar person={m.employee} size={28} /><span className="truncate">{personName(m.employee)}</span></span>
              <span className="flex items-center gap-2">
                <Badge tone={m.role === "LEAD" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                {ctx.canManage && <form action={removeMember.bind(null, project.id, m.employeeId)}><button aria-label={`Remove ${personName(m.employee)}`} className="px-1 text-muted hover:text-danger">×</button></form>}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Lead runs the project. Member works the cards. Viewer can only read and comment.</p>
        {ctx.canManage && !project.archivedAt && <div className="border-t border-line pt-4"><AddMemberForm projectId={project.id} people={people} /></div>}
      </div>
    );
  }
  if (panel === "labels") {
    return (
      <div className="space-y-5">
        <h2 className="pr-8 text-lg font-bold">Labels</h2>
        <ul className="space-y-2 text-sm">
          {ctx.labels.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <LabelChip label={l} />
              {ctx.canManage && <form action={deleteLabel.bind(null, project.id, l.id)}><button aria-label={`Delete label ${l.name}`} className="px-1 text-muted hover:text-danger">×</button></form>}
            </li>
          ))}
          {ctx.labels.length === 0 && <li className="text-muted">No labels yet.</li>}
        </ul>
        {ctx.canEdit && <div className="border-t border-line pt-4"><NewLabelForm projectId={project.id} /></div>}
      </div>
    );
  }
  if (panel === "activity") {
    return (
      <div className="space-y-4">
        <h2 className="pr-8 text-lg font-bold">Activity</h2>
        {activity.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
          <ul className="space-y-3 text-sm">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="font-semibold">{who.get(a.actorId) ?? "Former user"}</span> {EVENT[a.type] ?? a.type.toLowerCase()}{" "}
                {a.cardId ? <Link href={ctx.href({ card: a.cardId, panel: null })} scroll={false} className="text-brand hover:underline">{a.cardTitle}</Link> : <span>{a.detail}</span>}
                {a.cardId && a.detail && <span className="text-muted"> · {a.detail}</span>}
                <span className="block text-xs text-muted">{formatDay(dayKey(a.createdAt, ctx.tz), { month: "short", day: "numeric" })} {formatTime(a.createdAt, ctx.tz)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <h2 className="pr-8 text-lg font-bold">Project settings</h2>
      {ctx.canManage ? (
        <>
          <ProjectSettingsForm projectId={project.id} project={{ name: project.name, description: project.description ?? "", dueDay: project.dueDate ? keyOfDbDate(project.dueDate) : "", color: project.color }} />
          {!project.archivedAt && <form action={archiveProject.bind(null, project.id)} className="border-t border-line pt-4"><button className="text-sm font-medium text-danger hover:underline">Archive this project</button><p className="mt-1 text-xs text-muted">It leaves the project list and becomes read only. Nothing is deleted.</p></form>}
        </>
      ) : <p className="text-sm text-muted">Only a project lead or HR can change the project settings.</p>}
    </div>
  );
}
