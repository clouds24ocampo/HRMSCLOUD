"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTime, unlockPunch, type ClockResult } from "@/app/(app)/dtr/actions";
import { Alert } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { ClockType } from "@/lib/clock";

type Props = {
  state: "OUT" | "IN" | "ON_PAUSE";
  pause: { typeId: string | null; name: string; since: string } | null;
  types: ClockType[];
  requirePassword: boolean;
  timezone: string;
  lastText: string | null;
};

const CONTEXTS = [
  ["OFFICE", "Office"],
  ["FIELD", "Field work"],
  ["REMOTE", "Remote"],
  ["CLIENT_SITE", "Client site"],
] as const;

const TONE: Record<string, string> = {
  blue: "border-blue-400/30 bg-blue-500/15 text-blue-300",
  amber: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  indigo: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  slate: "border-slate-400/30 bg-slate-500/15 text-slate-300",
  teal: "border-teal-400/30 bg-teal-500/15 text-teal-300",
  red: "border-red-400/30 bg-red-500/15 text-red-300",
  green: "border-green-400/30 bg-green-500/15 text-green-300",
  violet: "border-violet-400/30 bg-violet-500/15 text-violet-300",
  pink: "border-pink-400/30 bg-pink-500/15 text-pink-300",
};

// Asks the device for its location at the moment of the time stamp only. No background tracking.
function getLocation(): Promise<{ geo: { lat: number; lng: number; accuracy: number } | null; geoError?: "DENIED" | "UNAVAILABLE" }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ geo: null, geoError: "UNAVAILABLE" });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ geo: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ geo: null, geoError: e.code === 1 ? "DENIED" : "UNAVAILABLE" }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function Step({ n, title, hint, right, children }: { n: number; title: string; hint?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-photon/40 bg-photon/10 text-sm font-bold text-photon">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{title}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function ClockCard({ state, pause, types, requirePassword, timezone, lastText }: Props) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [ctx, setCtx] = useState("OFFICE");
  const [note, setNote] = useState("");
  const [pw, setPw] = useState("");
  const [unlockedUntil, setUnlockedUntil] = useState<number | null>(null);
  const [unlockError, setUnlockError] = useState<string>();
  const [result, setResult] = useState<ClockResult>();
  const [step, setStep] = useState<"idle" | "verifying" | "locating">("idle");
  const [tab, setTab] = useState<"PUNCH" | "ISSUE">("PUNCH");
  const [trip, setTrip] = useState<{ open: boolean; from: string; to: string; reason: string }>({ open: false, from: "", to: "", reason: "" });
  const [, start] = useTransition();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const unlocked = !requirePassword || (unlockedUntil !== null && now !== null && now < unlockedUntil);
  const left = unlockedUntil && now ? Math.max(0, Math.ceil((unlockedUntil - now) / 1000)) : 0;
  const busy = step !== "idle";
  const pausedType = pause ? types.find((t) => t.id === pause.typeId) : undefined;
  const pausedSec = pause && now ? Math.max(0, Math.floor((now - new Date(pause.since).getTime()) / 1000)) : 0;
  const pausedOver = !!pausedType?.allowedMinutes && pausedSec > pausedType.allowedMinutes * 60;

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setUnlockError(undefined);
    setStep("verifying");
    start(async () => {
      const r = await unlockPunch(pw);
      setStep("idle");
      if (r.ok) {
        setUnlockedUntil(Date.now() + (r.seconds ?? 120) * 1000);
        setPw("");
        setResult(undefined);
      } else setUnlockError(r.error);
    });
  };

  const press = (t: ClockType, tripReady = false) => {
    setResult(undefined);
    const resumingNow = state === "ON_PAUSE" && pause?.typeId === t.id;
    if (t.key === "ON_TRIP" && !resumingNow && !tripReady) return setTrip((x) => ({ ...x, open: true }));
    const tripFields = t.key === "ON_TRIP" && !resumingNow ? { tripFrom: trip.from, tripTo: trip.to, tripReason: trip.reason } : {};
    setStep("locating");
    start(async () => {
      const loc = await getLocation();
      const r = await recordTime({ stampTypeId: t.id, workContext: (t.defaultContext ?? ctx) as "OFFICE", note: note || undefined, ...tripFields, ...loc });
      setStep("idle");
      setResult(r);
      if (r.needTrip) setTrip((x) => ({ ...x, open: true }));
      if (r.ok) {
        setNote("");
        setTrip({ open: false, from: "", to: "", reason: "" });
        setUnlockedUntil(null); // one unlock, one time stamp
        router.refresh();
      }
      if (r.locked) setUnlockedUntil(null);
    });
  };

  // Which tiles can be used right now.
  const why = (t: ClockType): string | null => {
    if (requirePassword && !unlocked) return "Verify your password to unlock";
    if (t.kind === "IN") return state === "OUT" ? null : "You are already timed in";
    if (t.kind === "OUT") return state === "OUT" ? "Time In first" : null;
    if (state === "OUT") return "Time In first";
    if (state === "IN") return t.rule;
    return pause?.typeId === t.id ? null : `End ${pause?.name} first`;
  };

  const time = now ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now) : " ";
  const date = now ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(now) : " ";
  const chip =
    state === "IN" ? ["bg-success/15 text-success", "Timed in"] : state === "ON_PAUSE" ? [pausedOver ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning", `${pause?.name} · ${clock(pausedSec)}`] : ["bg-white/10 text-muted", "Not timed in"];

  return (
    <section aria-label="Time clock" className="theme-quantum rounded-2xl border border-white/10 bg-[#0b0d22] p-5 text-ink shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{date}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${chip[0]}`}>{chip[1]}</span>
      </div>
      <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums" aria-live="off">{time}</p>
      {lastText && <p className="mt-1 text-sm text-muted">{lastText}</p>}

      <Step n={1} title="Where are you working?" hint={types.some((t) => t.defaultContext) ? "On Trip is always counted as field work." : undefined}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where are you working">
          {CONTEXTS.map(([v, l]) => (
            <button
              key={v} type="button" role="radio" aria-checked={ctx === v} onClick={() => setCtx(v)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition active:scale-95 ${ctx === v ? "border-photon bg-photon/15 text-photon" : "border-white/15 hover:bg-white/5"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </Step>

      {requirePassword && (
        <Step n={2} title="Verify your password" hint={unlocked ? "Verified. This unlocks one time stamp." : "Needed before every time stamp."}>
          {unlocked ? (
            <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success" role="status">
              Unlocked · {clock(left)} left
            </p>
          ) : (
            <form id="unlock-form" onSubmit={verify}>
              <input
                type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password"
                placeholder="Your password" aria-label="Your password" className={`${inputClass} mt-0`}
              />
            </form>
          )}
          {unlockError && <div className="mt-2"><Alert kind="error">{unlockError}</Alert></div>}
        </Step>
      )}

      <Step n={requirePassword ? 3 : 2} title="Choose an action" hint={unlocked ? "Pick what you are doing now." : "Verify your password to unlock"}>
        <label className="mb-3 block text-sm font-medium">
          Note {types.some((t) => t.requiresNote) ? "(needed for some actions)" : "(optional)"}
          <input
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Client visit, site inspection, issue details…"
            className={`${inputClass} ${result?.needNote ? "border-warning ring-2 ring-warning/40" : ""}`}
          />
        </label>
        <div className="mb-3 flex gap-2" role="tablist" aria-label="Time stamp pages">
          {([["PUNCH", "Punch"], ["ISSUE", "Issues"]] as const).map(([k, l]) => (
            <button
              key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${tab === k ? "border-photon bg-photon/15 text-photon" : "border-white/15 text-muted hover:bg-white/5"}`}
            >
              {l}
              {k === "ISSUE" && state === "ON_PAUSE" && types.find((x) => x.id === pause?.typeId)?.page === "ISSUE" && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warning" aria-label="active" />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {types.filter((t) => t.page === tab).map((t) => {
            const blocked = why(t);
            const resuming = state === "ON_PAUSE" && pause?.typeId === t.id;
            return (
              <button
                key={t.id} type="button" disabled={!!blocked || busy} onClick={() => press(t)} title={blocked ?? undefined}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition enabled:hover:bg-white/5 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
                  resuming ? "border-photon bg-photon/10 ring-2 ring-photon/40" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl ${TONE[t.tone] ?? TONE.slate}`} aria-hidden>{t.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{resuming ? `End ${t.name}` : t.name}</span>
                  {t.kind === "PAUSE" && !resuming && (blocked && !blocked.startsWith("Verify") && !blocked.startsWith("Time In") ? (
                    <span className="block text-xs text-warning">{blocked}</span>
                  ) : (
                    <span className="block text-xs text-muted">{[t.allowedMinutes ? `up to ${t.allowedMinutes} min` : null, t.hint].filter(Boolean).join(" · ")}</span>
                  ))}
                  {resuming && <span className={`block text-xs tabular-nums ${pausedOver ? "text-danger" : "text-muted"}`}>{clock(pausedSec)}{pausedOver ? " · over limit" : ""}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      {trip.open && state !== "ON_PAUSE" && (
        <form
          onSubmit={(e) => { e.preventDefault(); const t = types.find((x) => x.key === "ON_TRIP"); if (t) press(t, true); }}
          className="mt-4 space-y-3 rounded-2xl border border-photon/30 bg-photon/5 p-4"
        >
          <p className="text-sm font-semibold">On Trip: where are you going?</p>
          <p className="text-xs text-muted">Date and time are stamped automatically when you press Start trip.</p>
          {([["from", "Departure"], ["to", "Destination"], ["reason", "Reason for travel"]] as const).map(([k, l]) => (
            <label key={k} className="block text-sm font-medium">
              {l}
              <input
                value={trip[k]} onChange={(e) => setTrip((x) => ({ ...x, [k]: e.target.value }))} maxLength={120} required minLength={3}
                className={`${inputClass} ${result?.needTrip && trip[k].trim().length < 3 ? "border-warning ring-2 ring-warning/40" : ""}`}
              />
            </label>
          ))}
          <div className="flex gap-2">
            <button disabled={busy || !unlocked} className="rounded-xl bg-photon px-4 py-2 text-sm font-semibold text-void disabled:opacity-40">Start trip</button>
            <button type="button" onClick={() => setTrip({ open: false, from: "", to: "", reason: "" })} className="px-3 py-2 text-sm text-muted">Cancel</button>
          </div>
        </form>
      )}

      {requirePassword && !unlocked && (
        <button
          type="submit" form="unlock-form" disabled={!pw || busy}
          className="mt-5 min-h-14 w-full rounded-2xl bg-photon px-6 text-lg font-semibold text-void transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:bg-white/10 disabled:text-muted"
        >
          {step === "verifying" ? "Checking…" : pw ? "Verify and unlock" : "Enter your password to continue"}
        </button>
      )}

      <div className="mt-3 min-h-6" aria-live="polite">
        {step === "locating" && <p className="text-sm text-muted">Getting your location…</p>}
        {step === "idle" && result?.ok && <Alert kind="success">{result.ok}</Alert>}
        {step === "idle" && result?.error && <Alert kind="error">{result.error}</Alert>}
      </div>
      <p className="mt-2 text-xs text-muted">Your location is saved only when you press an action. Your supervisor chain and HR can see it.</p>
    </section>
  );
}
