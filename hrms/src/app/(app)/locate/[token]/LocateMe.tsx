"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/Fields";
import { bestFix } from "@/lib/geo-client";
import { submitLocationFix } from "../actions";

export function LocateMe({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<{ ok?: string; error?: string }>();
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setR(undefined);
            const loc = await bestFix({ targetMeters: 15, maxMs: 15_000 });
            if (!loc.geo) return setR({ error: loc.geoError === "DENIED" ? "Location is blocked. Allow location for this site in your phone's settings, then try again." : "Your phone could not find its location. Go near a window or outside and try again." });
            setR(await submitLocationFix(token, loc.geo));
          })
        }
        className="min-h-14 w-full rounded-2xl bg-brand px-6 text-lg font-semibold text-brand-ink transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Finding your exact location…" : "Send my phone's location"}
      </button>
      {r?.ok && <Alert kind="success">{r.ok}</Alert>}
      {r?.error && <Alert kind="error">{r.error}</Alert>}
    </div>
  );
}
