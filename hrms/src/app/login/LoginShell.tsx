"use client";

import { useState, type ReactNode } from "react";
import { LoginForm } from "./LoginForm";
import { TimeStampPanel } from "./TimeStampPanel";

// The login page has two doors: sign in to the workspace, or just time stamp with an ID number and password.
// The animated panel belongs to the sign-in door only: the time stamp page is a plain, centered form.
export function LoginShell({ startOnStamp, top, bottom, hero }: { startOnStamp: boolean; top: ReactNode; bottom: ReactNode; hero: ReactNode }) {
  const [tab, setTab] = useState<"signin" | "stamp">(startOnStamp ? "stamp" : "signin");
  const btn = (k: "signin" | "stamp", text: string) => (
    <button
      type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === k ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}
    >
      {text}
    </button>
  );
  return (
    <main className={`grid min-h-dvh ${tab === "signin" ? "md:grid-cols-2" : ""}`}>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          {top}
          <div role="tablist" aria-label="Sign in or time stamp" className="mb-6 flex gap-1 rounded-xl bg-line/50 p-1">
            {btn("signin", "Sign in")}
            {btn("stamp", "⏱️ Time stamp")}
          </div>
          {tab === "signin" ? <LoginForm /> : <TimeStampPanel />}
          {bottom}
        </div>
      </section>
      {tab === "signin" && hero}
    </main>
  );
}
