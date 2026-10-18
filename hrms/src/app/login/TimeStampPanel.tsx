"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Field } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { bestFix } from "@/lib/geo-client";
import { kioskLookup, kioskStamp, type KioskInfo } from "./kiosk-actions";

type ClockType = KioskInfo["clock"]["types"][number];
const CONTEXTS = [["OFFICE", "Office"], ["FIELD", "Field work"], ["REMOTE", "Remote"]] as const;

// Why a button cannot be used right now (same rules the DTR clock shows).
function blockedReason(t: ClockType, clock: KioskInfo["clock"]): string | null {
  if (t.kind === "IN") return clock.state === "IN" ? "You are already timed in" : null;
  if (t.kind === "OUT") return clock.state === "OUT" ? "Time In first" : null;
  if (clock.state === "OUT") return "Time In first";
  if (clock.state === "ON_PAUSE" && clock.pause?.typeId === t.id) return null; // ending the pause you are on is always allowed
  return t.rule;
}

function label(t: ClockType, clock: KioskInfo["clock"]) {
  const onPause = clock.state === "ON_PAUSE";
  if (t.kind === "IN") return onPause ? "Time In (resume work)" : "Time In";
  if (t.kind === "OUT") return "Time Out";
  if (onPause && clock.pause?.typeId === t.id) return `End ${t.name}`;
  if (onPause) return `Switch to ${t.name}`;
  return t.name;
}

// Time stamp without signing in: ID number + password, then the action. Nothing is stored in the browser: the password
// lives only in this component's memory, and the form clears itself a few seconds after a stamp (shared phones).
export function TimeStampPanel() {
  const [idNo, setIdNo] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState<KioskInfo | null>(null);
  const [busy, setBusy] = useState<"" | "checking" | "locating" | "saving">("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [ctx, setCtx] = useState<"OFFICE" | "FIELD" | "REMOTE">("OFFICE");
  const [note, setNote] = useState("");
  const [needNote, setNeedNote] = useState(false);
  const [tab, setTab] = useState<"PUNCH" | "ISSUE">("PUNCH");
  const [trip, setTrip] = useState<{ open: boolean; from: string; to: string; reason: string }>({ open: false, from: "", to: "", reason: "" });
  const [rough, setRough] = useState<ClockType | null>(null); // a computer: offer a stamp with its rough location
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const reset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setInfo(null); setPassword(""); setIdNo(""); setNote(""); setNeedNote(false); setError(undefined); setDone(undefined);
    setTrip({ open: false, from: "", to: "", reason: "" }); setRough(null); setTab("PUNCH"); setBusy("");
  };

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(undefined);
    setBusy("checking");
    const r = await kioskLookup(idNo, password).catch(() => ({ error: "Could not reach the system. Check your connection and try again." }));
    setBusy("");
    if ("info" in r && r.info) setInfo(r.info);
    else setError(r.error);
  };

  const press = async (t: ClockType, tripReady = false, allowRough = false) => {
    if (busy || !info) return;
    setError(undefined);
    setRough(null);
    if (t.key === "ON_TRIP" && info.clock.state !== "ON_PAUSE" && !tripReady) return setTrip((x) => ({ ...x, open: true }));
    setBusy("locating");
    const loc = await bestFix();
    setBusy("saving");
    const tripFields = t.key === "ON_TRIP" && info.clock.state !== "ON_PAUSE" ? { tripFrom: trip.from, tripTo: trip.to, tripReason: trip.reason } : {};
    const r = await kioskStamp(idNo, password, { stampTypeId: t.id, workContext: (t.defaultContext ?? ctx) as "OFFICE", note: note || undefined, ...tripFields, ...loc, allowRough: allowRough || undefined })
      .catch(() => ({ error: "Could not reach the system. Check your connection and try again." }) as { error: string; ok?: undefined; info?: undefined; needNote?: undefined; needTrip?: undefined; needPhone?: undefined });
    setBusy("");
    setNeedNote(!!r.needNote);
    if (r.needTrip) setTrip((x) => ({ ...x, open: true }));
    if (r.needPhone) setRough(t);
    if (r.ok) {
      setDone(r.ok);
      setPassword("");
      setNote("");
      if (r.info) setInfo(r.info);
      resetTimer.current = setTimeout(reset, 8000);
    } else if (r.error) setError(r.error);
  };

  if (done) {
    return (
      <div className="space-y-4" role="status">
        <div className="rounded-2xl border border-success/40 bg-success/10 p-5 text-center">
          <p className="text-3xl" aria-hidden>✅</p>
          <p className="mt-1 font-semibold text-success">{info?.name}</p>
          <p className="mt-1 text-sm">{done}</p>
        </div>
        <button type="button" onClick={reset} className="w-full rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:bg-bg">Done (this screen clears itself)</button>
      </div>
    );
  }

  if (!info) {
    return (
      <form onSubmit={lookup} className="space-y-4">
        <Field label="ID number" id="idNo" required autoFocus autoCapitalize="characters" spellCheck={false} autoComplete="off" value={idNo} onChange={(e) => setIdNo(e.target.value)} placeholder="Your employee ID number" />
        <Field label="Password" id="kioskPassword" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert kind="error">{error}</Alert>}
        <button type="submit" disabled={busy !== "" || !idNo || !password} className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-brand-ink shadow-md shadow-brand/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
          {busy === "checking" ? "Checking…" : "Continue"}
        </button>
        <p className="text-center text-xs text-muted">Your time, location and device are recorded when you press an action. You do not need to sign in.</p>
      </form>
    );
  }

  const { clock } = info;
  const state = clock.state === "IN" ? ["bg-success/15 text-success", "Timed in · Working"] : clock.state === "ON_PAUSE" ? ["bg-warning/15 text-warning", `On ${clock.pause?.name}`] : ["bg-line/60 text-muted", "Not timed in"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{info.name}</p>
          <p className="truncate text-xs text-muted">{info.org}{clock.lastText ? ` · ${clock.lastText}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state[0]}`}>{state[1]}</span>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where are you working">
        {CONTEXTS.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={ctx === v} onClick={() => setCtx(v)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${ctx === v ? "border-brand bg-brand/10 text-brand" : "border-line"}`}>{l}</button>
        ))}
      </div>

      <label className="block text-sm font-medium">
        Note {clock.types.some((t) => t.requiresNote) ? "(needed for some actions)" : "(optional)"}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${inputClass} ${needNote ? "border-warning ring-2 ring-warning/40" : ""}`} />
      </label>

      <div className="flex gap-2" role="tablist" aria-label="Time stamp pages">
        {(["PUNCH", "ISSUE"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg border px-4 py-1.5 text-sm font-semibold ${tab === k ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}>{k === "PUNCH" ? "Punch" : "Issues"}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {clock.types.filter((t) => t.page === tab).map((t) => {
          const why = blockedReason(t, clock);
          return (
            <button key={t.id} type="button" disabled={!!why || busy !== ""} onClick={() => press(t)} title={why ?? undefined}
              className="flex items-center gap-2 rounded-xl border border-line p-2.5 text-left transition enabled:hover:bg-bg enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40">
              <span className="text-xl" aria-hidden>{t.icon}</span>
              <span className="min-w-0 text-sm font-semibold leading-tight">
                {label(t, clock)}
                {why && t.kind === "PAUSE" && !why.startsWith("Time In") && <span className="block text-xs font-normal text-warning">{why}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {trip.open && clock.state !== "ON_PAUSE" && (
        <form onSubmit={(e) => { e.preventDefault(); const t = clock.types.find((x) => x.key === "ON_TRIP"); if (t) press(t, true); }} className="space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <p className="text-sm font-semibold">On Trip: where are you going?</p>
          {([["from", "Departure"], ["to", "Destination"], ["reason", "Reason for travel"]] as const).map(([k, l]) => (
            <label key={k} className="block text-sm font-medium">{l}
              <input value={trip[k]} onChange={(e) => setTrip((x) => ({ ...x, [k]: e.target.value }))} required minLength={3} maxLength={120} className={inputClass} />
            </label>
          ))}
          <div className="flex gap-2">
            <button disabled={busy !== ""} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">Start trip</button>
            <button type="button" onClick={() => setTrip({ open: false, from: "", to: "", reason: "" })} className="px-3 py-2 text-sm text-muted">Cancel</button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="min-h-6 space-y-2">
        {busy === "locating" && <p className="text-sm text-muted">Getting your exact location (a few seconds)…</p>}
        {busy === "saving" && <p className="text-sm text-muted">Saving…</p>}
        {error && <Alert kind="error">{error}</Alert>}
        {rough && (
          <button type="button" disabled={busy !== ""} onClick={() => press(rough, true, true)} className="w-full rounded-lg border border-line px-3 py-2 text-sm font-medium transition hover:bg-bg">
            I am on a computer: record {rough.name} with this computer&apos;s rough location (flagged, needs a note)
          </button>
        )}
      </div>
      <button type="button" onClick={reset} className="w-full text-sm font-medium text-muted hover:text-ink">Not you? Start over</button>
    </div>
  );
}
