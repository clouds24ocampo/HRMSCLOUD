// One place that decides whether a time stamp may be pressed right now. The server enforces it; the UI only shows the reason.
export type RuleStamp = { id: string; name: string; kind: "IN" | "OUT" | "PAUSE"; maxPerDay: number | null; requiresOvertimeOver: number | null };
export type RuleEvent = { type: "IN" | "OUT" | "PAUSE_START" | "PAUSE_END"; at: Date; stampTypeId: string | null };

// Events of the employee's current work day: everything from the latest Time In (36 h window is loaded by the caller).
export function currentDayEvents(events: RuleEvent[]): RuleEvent[] {
  let start = -1;
  events.forEach((e, i) => { if (e.type === "IN") start = i; });
  return start < 0 ? [] : events.slice(start);
}

export function usedToday(events: RuleEvent[], stampId: string): number {
  return currentDayEvents(events).filter((e) => e.type === "PAUSE_START" && e.stampTypeId === stampId).length;
}

// Returns a blocking reason, or null when the stamp may be used. `resuming` = this press ends the open pause.
export function stampBlock(stamp: RuleStamp, events: RuleEvent[], approvedOvertimeMinutes: number, resuming: boolean): string | null {
  if (stamp.kind !== "PAUSE" || resuming) return null;
  if (stamp.requiresOvertimeOver != null && approvedOvertimeMinutes <= stamp.requiresOvertimeOver) {
    const h = stamp.requiresOvertimeOver / 60;
    return `Needs approved overtime over ${Number.isInteger(h) ? `${h} h` : `${stamp.requiresOvertimeOver} min`}`;
  }
  if (stamp.maxPerDay != null && usedToday(events, stamp.id) >= stamp.maxPerDay) return "Already used today";
  return null;
}

export type TripInput = { tripFrom?: string; tripTo?: string; tripReason?: string };
export function tripError(t: TripInput): string | null {
  for (const v of [t.tripFrom, t.tripTo, t.tripReason]) {
    const s = (v ?? "").trim();
    if (s.length < 3 || s.length > 120) return "On Trip needs departure, destination and reason (3 to 120 characters each).";
  }
  return null;
}
