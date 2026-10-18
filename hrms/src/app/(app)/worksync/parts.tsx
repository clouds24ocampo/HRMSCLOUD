import { avatarColor, initials, labelColor, type DueState } from "@/lib/worksync";

// Small pieces shared by every view. No state, so they work in server and client components alike.

export function Avatar({ person, size = 24 }: { person: { firstName: string; lastName: string }; size?: number }) {
  const name = `${person.firstName} ${person.lastName}`;
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-surface font-bold text-white"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: Math.max(8, Math.round(size * 0.38)) }}
    >
      {initials(person)}
    </span>
  );
}

export function Facepile({ people, max = 4, size = 24 }: { people: { firstName: string; lastName: string }[]; max?: number; size?: number }) {
  if (people.length === 0) return null;
  return (
    <span className="flex -space-x-1.5">
      {people.slice(0, max).map((p, i) => <Avatar key={i} person={p} size={size} />)}
      {people.length > max && <span className="inline-flex items-center justify-center rounded-full border-2 border-surface bg-line text-[10px] font-bold text-muted" style={{ width: size, height: size }}>+{people.length - max}</span>}
    </span>
  );
}

export function LabelChip({ label, compact = false }: { label: { name: string; color: string }; compact?: boolean }) {
  return (
    <span className={`inline-block max-w-full truncate rounded-md font-semibold text-white ${compact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs"}`} style={{ backgroundColor: labelColor(label.color) }} title={label.name}>
      {label.name}
    </span>
  );
}

const DUE_STYLE: Record<DueState, string> = {
  done: "bg-success/15 text-success",
  overdue: "bg-danger/15 text-danger",
  soon: "bg-warning/20 text-warning",
  later: "bg-line/70 text-muted",
};
export function DueBadge({ label, state }: { label: string; state: DueState }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${DUE_STYLE[state]}`}><span aria-hidden>{state === "done" ? "✓" : "🕒"}</span>{label}{state === "overdue" && <span className="sr-only"> (overdue)</span>}</span>;
}

// A colored pill, the way a status or priority sits in a table cell.
export function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-block w-full truncate rounded-md px-2 py-1 text-center text-xs font-semibold text-white" style={{ backgroundColor: color }}>{children}</span>;
}

export function Bar({ percent, color = "var(--brand)", className = "" }: { percent: number; color?: string; className?: string }) {
  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress" className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>
  );
}
