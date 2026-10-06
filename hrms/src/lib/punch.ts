import type { Punch } from "@/lib/dtr";

// Shape of a TimeEvent row with its stamp type, as loaded by the pages.
export type EventRow = {
  type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END";
  at: Date;
  stampType?: { id: string; name: string; paid: boolean; allowedMinutes: number | null; dailyCapMinutes?: number | null } | null;
};

export const STAMP_SELECT = { id: true, name: true, icon: true, paid: true, allowedMinutes: true, dailyCapMinutes: true } as const;

export const toPunch = (e: EventRow): Punch => ({
  type: e.type,
  at: e.at,
  stamp: e.stampType ? { id: e.stampType.id, name: e.stampType.name, paid: e.stampType.paid, allowedMinutes: e.stampType.allowedMinutes, dailyCapMinutes: e.stampType.dailyCapMinutes ?? null } : null,
});

const LEGACY = { IN: "Time In", OUT: "Time Out", PAUSE_START: "Break", PAUSE_END: "Break" } as const;

// "Time In", "Break (start)", "Meal (end)"…
export function punchLabel(e: { type: EventRow["type"]; stampType?: { name: string } | null }): string {
  const name = e.stampType?.name ?? LEGACY[e.type];
  return e.type === "PAUSE_START" ? `${name} (start)` : e.type === "PAUSE_END" ? `${name} (end)` : name;
}
