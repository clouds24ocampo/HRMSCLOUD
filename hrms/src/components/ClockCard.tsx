"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { useRouter } from "next/navigation";
import { recordTime, unlockPunch, type ClockResult } from "@/app/(app)/dtr/actions";
import { Alert } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { ClockType } from "@/lib/clock";
import { bestFix, isDesktop } from "@/lib/geo-client";
import { PhoneLocation } from "@/components/PhoneLocation";

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
  ["FIELD", "Field work / Client site"],
  ["REMOTE", "Remote"],
] as const;

const TONE: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  teal: "border-teal-200 bg-teal-50 text-teal-700",
  red: "border-red-200 bg-red-50 text-red-700",
  green: "border-green-200 bg-green-50 text-green-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  pink: "border-pink-200 bg-pink-50 text-pink-700",
};

const noSubscribe = () => () => {};
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function Step({ n, title, hint, right, children }: { n: number; title: string; hint?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-sm font-bold text-brand">{n}</span>
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
  const [phone, setPhone] = useState<{ open: boolean; token?: string; accuracy?: number }>({ open: false });
  const [retry, setRetry] = useState<ClockType | null>(null); // the stamp that waits for the phone
  // Computer or phone: known only in the browser, so the server render says "phone" and the client corrects it.
  const desktop = useSyncExternalStore(noSubscribe, isDesktop, () => false);

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

  const press = (t: ClockType, tripReady = false, allowRough = false) => {
    setResult(undefined);
    const resumingNow = state === "ON_PAUSE" && pause?.typeId === t.id;
    if (t.key === "ON_TRIP" && !resumingNow && !tripReady) return setTrip((x) => ({ ...x, open: true }));
    const tripFields = t.key === "ON_TRIP" && !resumingNow ? { tripFrom: trip.from, tripTo: trip.to, tripReason: trip.reason } : {};
    setStep("locating");
    start(async () => {
      // With a phone fix in hand there is nothing to measure here; otherwise sample the device for its best fix.
      const loc = phone.token ? { geo: null } : await bestFix();
      const r = await recordTime({ stampTypeId: t.id, workContext: (t.defaultContext ?? ctx) as "OFFICE", note: note || undefined, ...tripFields, ...loc, linkToken: phone.token, allowRough: allowRough || undefined });
      setStep("idle");
      setResult(r);
      if (r.needTrip) setTrip((x) => ({ ...x, open: true }));
      if (r.needPhone) {
        setPhone({ open: true });
        setRetry(t);
      }
      if (r.ok) {
        setPhone({ open: false });
        setRetry(null);
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
    if (t.kind === "IN") {
      if (state === "OUT") return null;
      if (state === "ON_PAUSE") return null; // Can click Time In to resume work from any pause/issue
      return "You are already actively timed in and working";
    }
    if (t.kind === "OUT") {
      if (state === "OUT") return "Time In first";
      return null;
    }
    if (state === "OUT") return "Time In first";
    // Ending the pause you are on is always allowed: its daily limit applies to starting it, not to stopping it.
    if (state === "ON_PAUSE" && pause?.typeId === t.id) return null;
    // State is IN or ON_PAUSE: any pause/issue can be started or switched to
    return t.rule;
  };

  const time = now ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now) : " ";
  const date = now ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(now) : " ";
  const chip =
    state === "IN"
      ? ["bg-success/15 text-success", "Timed in · Working"]
      : state === "ON_PAUSE"
      ? [
          pausedOver ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning",
          `${pause?.name} · ${clock(pausedSec)} · Click Time In to resume`,
        ]
      : ["bg-line/60 text-muted", "Not timed in"];

  return (
    <section aria-label="Time clock" className="rounded-3xl border border-line bg-surface p-6 text-ink shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{date}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${chip[0]}`}>{chip[1]}</span>
      </div>
      <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums text-ink" aria-live="off">{time}</p>
      {lastText && <p className="mt-1 text-sm text-muted">{lastText}</p>}

      <Step n={1} title="Where are you working?" hint={types.some((t) => t.defaultContext) ? "On Trip is always counted as field work / client site." : undefined}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where are you working">
          {CONTEXTS.map(([v, l]) => (
            <button
              key={v} type="button" role="radio" aria-checked={ctx === v} onClick={() => setCtx(v)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition active:scale-95 ${
                ctx === v
                  ? "border-brand bg-brand/10 font-semibold text-brand shadow-xs"
                  : "border-line bg-surface text-ink hover:bg-bg"
              }`}
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
              <PasswordInput
                value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password"
                placeholder="Your password" aria-label="Your password" className={`${inputClass} mt-0`}
              />
            </form>
          )}
          {unlockError && <div className="mt-2"><Alert kind="error">{unlockError}</Alert></div>}
        </Step>
      )}

      <Step
        n={requirePassword ? 3 : 2}
        title="Choose an action"
        hint={
          unlocked
            ? state === "ON_PAUSE"
              ? `You are on ${pause?.name}. Click Time In to resume work, or choose another tagging to switch.`
              : "Pick what you are doing now."
            : "Verify your password to unlock"
        }
      >
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
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                tab === k
                  ? "border-brand bg-brand/10 text-brand shadow-xs"
                  : "border-line bg-surface text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              {l}
              {k === "ISSUE" && state === "ON_PAUSE" && types.find((x) => x.id === pause?.typeId)?.page === "ISSUE" && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warning" aria-label="active" />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {types.filter((t) => t.page === tab).map((t) => {
            const blocked = why(t);
            const resuming = state === "ON_PAUSE" && (pause?.typeId === t.id || t.kind === "IN");
            const switching = state === "ON_PAUSE" && t.kind === "PAUSE" && pause?.typeId !== t.id;

            let buttonTitle = t.name;
            let buttonHint = [t.allowedMinutes ? `up to ${t.allowedMinutes} min` : null, t.hint].filter(Boolean).join(" · ");

            if (t.kind === "IN") {
              if (state === "ON_PAUSE") {
                buttonTitle = "Time In (Resume Work)";
                buttonHint = `End ${pause?.name} & resume work`;
              } else if (state === "OUT") {
                buttonTitle = "Time In";
                buttonHint = "Start your shift";
              }
            } else if (t.kind === "OUT") {
              buttonTitle = "Time Out";
              buttonHint = "Shift completed (once a day)";
            } else if (resuming && pause?.typeId === t.id) {
              buttonTitle = `End ${t.name}`;
              buttonHint = "Click to resume work";
            } else if (switching) {
              buttonTitle = `Switch to ${t.name}`;
              buttonHint = `Switch from ${pause?.name}`;
            }

            return (
              <button
                key={t.id} type="button" disabled={!!blocked || busy} onClick={() => press(t)} title={blocked ?? undefined}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition enabled:hover:bg-bg enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
                  resuming
                    ? "border-brand bg-brand/10 ring-2 ring-brand/30 font-medium"
                    : switching
                    ? "border-amber-300 bg-amber-50/70 hover:border-amber-400"
                    : "border-line bg-surface hover:border-line/80 shadow-xs"
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl ${TONE[t.tone] ?? TONE.slate}`} aria-hidden>{t.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{buttonTitle}</span>
                  {blocked && !blocked.startsWith("Verify") && !blocked.startsWith("Time In") ? (
                    <span className="block text-xs text-warning">{blocked}</span>
                  ) : buttonHint ? (
                    <span className="block text-xs text-muted">{buttonHint}</span>
                  ) : null}
                  {resuming && pause?.typeId === t.id && (
                    <span className={`block text-xs tabular-nums ${pausedOver ? "text-danger" : "text-muted"}`}>{clock(pausedSec)}{pausedOver ? " · over limit" : ""}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      {trip.open && state !== "ON_PAUSE" && (
        <form
          onSubmit={(e) => { e.preventDefault(); const t = types.find((x) => x.key === "ON_TRIP"); if (t) press(t, true); }}
          className="mt-4 space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-4"
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
            <button disabled={busy || !unlocked} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-xs disabled:opacity-40">Start trip</button>
            <button type="button" onClick={() => setTrip({ open: false, from: "", to: "", reason: "" })} className="px-3 py-2 text-sm text-muted">Cancel</button>
          </div>
        </form>
      )}

      {requirePassword && !unlocked && (
        <button
          type="submit" form="unlock-form" disabled={!pw || busy}
          className="mt-5 min-h-14 w-full rounded-2xl bg-brand px-6 text-lg font-semibold text-white shadow-md shadow-brand/20 transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:bg-line disabled:text-muted"
        >
          {step === "verifying" ? "Checking…" : pw ? "Verify and unlock" : "Enter your password to continue"}
        </button>
      )}

      {phone.token && (
        <p role="status" className="mt-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          📱 Phone location received (±{Math.round(phone.accuracy ?? 0)} m). {retry ? `Press ${retry.name} again to record it.` : "It is used for your next time stamp."}
        </p>
      )}
      {phone.open && !phone.token && (
        <>
          <PhoneLocation onReady={(token, accuracy) => setPhone({ open: false, token, accuracy })} onClose={() => setPhone({ open: false })} />
          {retry && (
            <button type="button" disabled={busy} onClick={() => press(retry, true, true)} className="mt-2 text-xs font-medium text-muted underline hover:text-ink">
              I cannot use my phone: record {retry.name} with this computer&apos;s rough location (flagged, needs a note)
            </button>
          )}
        </>
      )}
      {desktop && !phone.open && !phone.token && (
        <button type="button" onClick={() => setPhone({ open: true })} className="mt-4 text-sm font-medium text-brand hover:underline">
          💻 On a computer? Confirm your exact location with your phone first
        </button>
      )}

      <div className="mt-3 min-h-6" aria-live="polite">
        {step === "locating" && <p className="text-sm text-muted">Getting your exact location (a few seconds)…</p>}
        {step === "idle" && result?.ok && <Alert kind="success">{result.ok}</Alert>}
        {step === "idle" && result?.error && <Alert kind="error">{result.error}</Alert>}
      </div>
      <p className="mt-2 text-xs text-muted">Your location, device and network address are saved only when you press an action. Your supervisor chain and HR can see them.</p>
    </section>
  );
}
