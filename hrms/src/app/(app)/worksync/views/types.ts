import type { CardRow } from "@/lib/worksync-data";
import type { Category } from "@/lib/worksync";

// What every view of a project receives: the cards that passed the filters, and what the viewer may do.
export type ViewCtx = {
  projectId: string;
  today: string;
  /** Server time in ms, taken once per request so every view agrees on "now". */
  now: number;
  tz: string;
  lists: { id: string; name: string; category: Category }[];
  labels: { id: string; name: string; color: string }[];
  members: { employeeId: string; firstName: string; lastName: string; role: string }[];
  cards: CardRow[];
  canEdit: boolean;
  canManage: boolean;
  selected?: string;
  filtered: boolean;
  /** URL of this project page with some query parameters changed (null removes one); filters and view are kept. */
  href: (patch: Record<string, string | null>) => string;
};
