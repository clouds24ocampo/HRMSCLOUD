"use client";

import { Icon } from "@/components/Icon";
import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import { formatDay } from "@/lib/time";
import { PRIORITY_LABEL } from "@/lib/worksync";
import { createCard } from "../actions";

export function CalendarCellAdd({
  projectId,
  day,
  lists,
  canEdit,
}: {
  projectId: string;
  day: string;
  lists: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id ?? "");

  const f = useKeptForm(async (_state, form) => {
    const res = await createCard(projectId, selectedListId, _state, form);
    if (res && "ok" in res && res.ok) {
      setOpen(false);
    }
    return res;
  });

  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="opacity-0 transition group-hover:opacity-100 rounded p-0.5 text-xs text-muted hover:bg-line hover:text-ink"
        title={`Add card for ${day}`}
        aria-label={`Add card for ${day}`}
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-semibold text-lg text-ink">Add card for {formatDay(day, { month: "short", day: "numeric", year: "numeric" })}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-bg hover:text-ink">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <form {...f.formProps} className="mt-4 space-y-4 text-left">
              <label className="block text-sm font-medium">
                Title
                <input
                  name="title"
                  required
                  maxLength={200}
                  placeholder="What needs to be done?"
                  autoFocus
                  className={`${inputClass} mt-1`}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  List / Status
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className={`${inputClass} mt-1`}
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium">
                  Priority
                  <select name="priority" defaultValue="NORMAL" className={`${inputClass} mt-1`}>
                    {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Due Date
                  <input type="date" name="dueDate" defaultValue={day} className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-sm font-medium">
                  Start Date
                  <input type="date" name="startDate" defaultValue={day} className={`${inputClass} mt-1`} />
                </label>
              </div>

              {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostClass}>
                  Cancel
                </button>
                <button disabled={f.pending} className={buttonClass}>
                  {f.pending ? "Adding…" : "Add card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
