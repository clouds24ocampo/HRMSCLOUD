import { daysBetween, weekday } from "@/lib/time";

// Leave is charged only for days the person would have worked.
// A planned shift counts, a planned day off does not. With no plan for a day, Monday to Friday count.
export function countLeaveDays(from: string, to: string, schedule: Map<string, boolean>): number {
  return daysBetween(from, to).filter((k) => {
    if (schedule.has(k)) return schedule.get(k)!;
    const wd = weekday(k);
    return wd >= 1 && wd <= 5;
  }).length;
}

export const LEAVE_STATUS = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
} as const;
