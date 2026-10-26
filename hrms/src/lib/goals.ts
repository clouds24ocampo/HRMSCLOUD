export type GoalStatus = "ACTIVE" | "ACHIEVED" | "DROPPED";

// One rule for goals, used by the form and the server: 100% is achieved, achieved is 100%, and a dropped goal stays dropped.
export function goalOutcome(progress: number, status: GoalStatus): { progress: number; status: GoalStatus } {
  if (status === "DROPPED") return { progress, status };
  if (status === "ACHIEVED") return { progress: 100, status };
  return progress >= 100 ? { progress: 100, status: "ACHIEVED" } : { progress, status };
}
