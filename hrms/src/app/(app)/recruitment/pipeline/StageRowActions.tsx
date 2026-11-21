"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/Fields";
import { moveApplicant } from "../actions";

type Move = "SCREENING" | "INTERVIEW" | "REQUIREMENTS" | "OFFER";
const LABEL: Record<Move, string> = { SCREENING: "Screening", INTERVIEW: "Interview", REQUIREMENTS: "Requirements", OFFER: "Orientation & contract" };

// Move to the next stage from the list. When the person is not complete yet the confirmation names what is missing,
// so HR can still move them on purpose. From the last stage the next step is hiring, which lives on the applicant's card.
export function StageRowActions({ id, name, jobId, next, ready, missing }: { id: string; name: string; jobId: string; next: Move | "HIRE"; ready: boolean; missing: string[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold transition active:scale-95 disabled:opacity-60";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/recruitment/${jobId}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">Open card</Link>
        {next === "HIRE" ? (
          <Link href={`/recruitment/${jobId}`} className={`${btn} ${ready ? "bg-success text-white hover:brightness-110" : "border border-warning text-warning hover:bg-warning/10"}`}>{ready ? "Hire →" : "Hire (not ready)"}</Link>
        ) : (
          <button
            type="button" disabled={pending}
            onClick={() => {
              const q = ready ? `Move ${name} to ${LABEL[next]}?` : `${name} is not complete yet. Still missing: ${missing.join(", ")}.\n\nMove to ${LABEL[next]} anyway?`;
              if (!confirm(q)) return;
              setErr(undefined);
              start(async () => { const r = await moveApplicant(id, next); if (r?.error) setErr(r.error); });
            }}
            className={`${btn} ${ready ? "bg-brand text-brand-ink shadow-sm hover:brightness-110" : "border border-line hover:bg-bg"}`}
          >
            {pending ? "Moving…" : `Move to ${LABEL[next]} →`}
          </button>
        )}
      </div>
      {err && <Alert kind="error">{err}</Alert>}
    </div>
  );
}
