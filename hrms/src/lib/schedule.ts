// One place that answers: "what was this person scheduled to do on this day?"
// Order of precedence: a specific-day override, then the regular weekly schedule that was in effect that day, then nothing.
import { weekday } from "@/lib/time";

export type ShiftLite = { name: string; startTime: string; endTime: string; breakMinutes: number };
export type RegularRow = { effectiveFrom: string; workDays: number[]; shift: ShiftLite };
export type Resolved = { shift: ShiftLite | null; source: "override" | "regular" }; // shift null = day off

// `regulars` must be sorted by effectiveFrom ascending.
export function resolveDay(day: string, override: { shift: ShiftLite | null } | undefined, regulars: RegularRow[]): Resolved | null {
  if (override) return { shift: override.shift, source: "override" };
  let current: RegularRow | undefined;
  for (const r of regulars) if (r.effectiveFrom <= day) current = r;
  if (!current) return null;
  return { shift: current.workDays.includes(weekday(day)) ? current.shift : null, source: "regular" };
}

export function resolveRange(days: string[], overrides: Map<string, { shift: ShiftLite | null }>, regulars: RegularRow[]): Map<string, Resolved> {
  const out = new Map<string, Resolved>();
  for (const d of days) {
    const r = resolveDay(d, overrides.get(d), regulars);
    if (r) out.set(d, r);
  }
  return out;
}

export const hasRegular = (regulars: RegularRow[], day: string) => regulars.some((r) => r.effectiveFrom <= day);

export const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Monday-first display order of the weekday numbers.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function describeDays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  const ordered = WEEK_ORDER.filter((d) => set.has(d));
  // Consecutive Monday-first run, e.g. Mon–Fri.
  const runOk = ordered.length > 2 && ordered.every((d, i) => i === 0 || WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(ordered[i - 1]) + 1);
  return runOk ? `${WEEKDAY_LABEL[ordered[0]]}–${WEEKDAY_LABEL[ordered[ordered.length - 1]]}` : ordered.map((d) => WEEKDAY_LABEL[d]).join(", ");
}

// ───────── Team-linked schedules ─────────
// A person is "linked" when they follow their supervisor's regular schedule. Changing a supervisor's schedule flows down to every
// linked person below them (their supervisor chain, not only direct reports). Editing someone directly makes them Custom.
export type TeamRow = { id: string; managerId: string | null; scheduleLinked: boolean };

// Everyone who must receive the same regular schedule because of an edit to `edited`. Never includes people already edited.
export function followersOf(rows: TeamRow[], edited: string[]): string[] {
  const skip = new Set(edited);
  const kids = new Map<string, TeamRow[]>();
  for (const r of rows) if (r.managerId) kids.set(r.managerId, [...(kids.get(r.managerId) ?? []), r]);
  const out: string[] = [];
  const stack = [...edited];
  while (stack.length) {
    for (const k of kids.get(stack.pop()!) ?? []) {
      if (!k.scheduleLinked || skip.has(k.id)) continue;
      skip.add(k.id);
      out.push(k.id);
      stack.push(k.id);
    }
  }
  return out;
}

// Edited people who now differ from their supervisor: they have one, and the supervisor is not part of the same edit.
export function becomeCustom(rows: TeamRow[], edited: string[]): string[] {
  const set = new Set(edited);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return edited.filter((id) => {
    const m = byId.get(id)?.managerId;
    return !!m && !set.has(m) && byId.get(id)!.scheduleLinked;
  });
}

// A supervisor plus everyone below them: the "team" a click on a leader selects.
export function teamOf(rows: TeamRow[], leaderId: string): string[] {
  return [leaderId, ...followersOfAll(rows, leaderId)];
}
function followersOfAll(rows: TeamRow[], leaderId: string): string[] {
  const kids = new Map<string, string[]>();
  for (const r of rows) if (r.managerId) kids.set(r.managerId, [...(kids.get(r.managerId) ?? []), r.id]);
  const out: string[] = [];
  const stack = [leaderId];
  while (stack.length) for (const k of kids.get(stack.pop()!) ?? []) { out.push(k); stack.push(k); }
  return out;
}
