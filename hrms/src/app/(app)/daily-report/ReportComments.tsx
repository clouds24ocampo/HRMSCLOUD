import { Badge } from "@/components/ui";
import { formatDay, formatTime, dayKey } from "@/lib/time";
import { CommentForm } from "./CommentForm";

export type Comment = { id: string; authorId: string; parentId: string | null; body: string; createdAt: Date };
export type Author = { name: string; role: string };

// The thread under one report: comments oldest first, each with its replies, and a box to write.
export function ReportComments({ reportId, comments, authors, meId, tz }: { reportId: string; comments: Comment[]; authors: Map<string, Author>; meId: string; tz: string }) {
  const roots = comments.filter((c) => !c.parentId);
  const who = (c: Comment) => {
    const a = authors.get(c.authorId);
    return (
      <span className="font-semibold">
        {c.authorId === meId ? "You" : a?.name ?? "Removed user"}
        {a && c.authorId !== meId && <span className="ml-1 font-normal text-muted">· {a.role}</span>}
      </span>
    );
  };
  const when = (d: Date) => `${formatDay(dayKey(d, tz), { month: "short", day: "numeric" })} ${formatTime(d, tz)}`;
  return (
    <details className="mt-3 rounded-xl border border-line bg-bg/50" open={comments.length > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium marker:hidden">
        <span>💬 Comments</span>
        <Badge tone={comments.length ? "brand" : "neutral"}>{comments.length}</Badge>
      </summary>
      <div className="space-y-3 border-t border-line p-3">
        {roots.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
        {roots.map((c) => {
          const replies = comments.filter((r) => r.parentId === c.id);
          return (
            <div key={c.id} className="space-y-2">
              <div className="rounded-lg bg-surface p-3 text-sm shadow-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs">{who(c)}<span className="text-muted">{when(c.createdAt)}</span></p>
                <p className="mt-1 whitespace-pre-line">{c.body}</p>
              </div>
              {replies.length > 0 && (
                <ul className="space-y-2 border-l-2 border-line pl-3">
                  {replies.map((r) => (
                    <li key={r.id} className="rounded-lg bg-surface p-3 text-sm shadow-sm">
                      <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs">{who(r)}<span className="text-muted">{when(r.createdAt)}</span></p>
                      <p className="mt-1 whitespace-pre-line">{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <details className="pl-3">
                <summary className="cursor-pointer text-xs font-semibold text-brand">Reply</summary>
                <div className="mt-2"><CommentForm reportId={reportId} parentId={c.id} label="Write a reply" button="Reply" /></div>
              </details>
            </div>
          );
        })}
        <CommentForm reportId={reportId} />
      </div>
    </details>
  );
}
