"use client";

import { Icon, ICON_INLINE } from "@/components/Icon";
import { useState, type ReactNode } from "react";
import { LoginForm } from "./LoginForm";
import { TimeStampPanel } from "./TimeStampPanel";

// The login page has two doors: sign in to the workspace, or just time stamp with an ID number and password.
// The landing page hero (the liquid sculpture) is the background of both doors; the form is a card on top of it.
// The card section lets pointer events through outside the card, so the sculpture still reacts to the cursor.
export function LoginShell({ startOnStamp, top, bottom, hero }: { startOnStamp: boolean; top: ReactNode; bottom: ReactNode; hero: ReactNode }) {
  const [tab, setTab] = useState<"signin" | "stamp">(startOnStamp ? "stamp" : "signin");
  const btn = (k: "signin" | "stamp", text: ReactNode) => (
    <button
      type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === k ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}
    >
      {text}
    </button>
  );
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#111110]">
      <div className="absolute inset-0">{hero}</div>
      <section className="pointer-events-none relative z-10 flex min-h-dvh items-center justify-center px-4 pt-24 pb-10 lg:justify-end lg:py-10 lg:pr-[8vw]">
        <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-surface/95 p-7 shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:p-8">
          {top}
          <div role="tablist" aria-label="Sign in or time stamp" className="mb-6 flex gap-1 rounded-xl bg-line/50 p-1">
            {btn("signin", "Sign in")}
            {btn("stamp", <><Icon name="dtr" className={ICON_INLINE} /> Time stamp</>)}
          </div>
          {tab === "signin" ? (
            <>
              <LoginForm />
              {bottom}
            </>
          ) : (
            <TimeStampPanel />
          )}
        </div>
      </section>
    </main>
  );
}
