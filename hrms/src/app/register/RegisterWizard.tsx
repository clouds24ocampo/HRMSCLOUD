"use client";

import { useActionState, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, SIZES } from "@/lib/industries";
import { Tilt } from "@/components/Tilt";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { registerOrganization } from "./actions";

const STEPS = ["Industry", "Details", "Your account"];
const glass =
  "border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_24px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl";
const ghostButton = `rounded-xl px-5 py-2.5 font-medium transition hover:bg-white/10 active:scale-95 ${glass}`;

export function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [categoryKey, setCategory] = useState("");
  const [industryKey, setIndustry] = useState("");
  const [sizeKey, setSize] = useState("");
  // Kept in state: React clears uncontrolled fields after a failed submit.
  const [text, setText] = useState({ orgName: "", adminName: "", email: "" });
  const bind = (k: keyof typeof text) => ({
    value: text[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setText({ ...text, [k]: e.target.value }),
  });
  const [state, action, pending] = useActionState(registerOrganization, undefined);
  const category = CATEGORIES.find((c) => c.key === categoryKey);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ol className="mb-10 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-2" aria-current={i === step ? "step" : undefined}>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.span
                className="block h-full origin-left rounded-full bg-linear-to-r from-[#5eead4] via-photon to-[#e879f9] shadow-[0_0_12px_rgba(143,162,255,0.8)]"
                initial={false}
                animate={{ scaleX: i <= step ? 1 : 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </span>
            <span className={`text-xs font-medium transition-colors ${i === step ? "text-ink" : "text-muted"}`}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      <div className="relative">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40, rotateY: -8 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: -40, rotateY: 8 }}
            transition={{ duration: 0.3 }}
            style={{ perspective: 1200 }}
          >
            {step === 0 && (
              <section>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What kind of organization are you?</h1>
                <p className="mt-1 mb-6 text-muted">Pick the closest match. You can refine it next.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" style={{ perspective: 1200 }}>
                  {CATEGORIES.map((c, i) => (
                    <motion.div
                      key={c.key}
                      initial={{ opacity: 0, rotateX: -45, y: 40, scale: 0.9 }}
                      animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 130, damping: 15, delay: 0.1 + i * 0.05 }}
                      style={{ transformOrigin: "50% 100%" }}
                    >
                      <Tilt max={16} glare className="rounded-2xl">
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(c.key);
                            setIndustry("");
                            setStep(1);
                          }}
                          className={`flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-2xl p-3 text-center transition-shadow hover:shadow-[0_0_32px_-6px_rgba(143,162,255,0.7)] active:scale-95 ${glass} ${
                            c.key === categoryKey ? "border-photon ring-2 ring-photon/40" : ""
                          }`}
                        >
                          <span className="[transform:translateZ(46px)]">
                            <motion.span layoutId={`icon-${c.key}`} className="block text-4xl drop-shadow-[0_14px_12px_rgba(0,0,0,0.55)]" aria-hidden>
                              {c.icon}
                            </motion.span>
                          </span>
                          <span className="text-sm leading-tight font-semibold [transform:translateZ(22px)]">{c.name}</span>
                        </button>
                      </Tilt>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {step === 1 && category && (
              <section>
                <div className="mb-6 flex items-center gap-4">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-[0_0_40px_-6px_rgba(143,162,255,0.8)] ${glass}`}
                  >
                    <motion.span layoutId={`icon-${category.key}`} className="block text-4xl" aria-hidden>
                      {category.icon}
                    </motion.span>
                  </motion.div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{category.name}</h1>
                    <p className="text-muted">Choose your type and size.</p>
                  </div>
                </div>

                <fieldset className="mb-6">
                  <legend className="mb-2 text-sm font-semibold">Type</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {category.segments.map((s) => (
                      <Choice key={s.key} selected={industryKey === s.key} onClick={() => setIndustry(s.key)}>
                        {s.name}
                      </Choice>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mb-8">
                  <legend className="mb-2 text-sm font-semibold">Size</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SIZES.map((s) => (
                      <Choice key={s.key} selected={sizeKey === s.key} onClick={() => setSize(s.key)}>
                        {s.name}
                      </Choice>
                    ))}
                  </div>
                </fieldset>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(0)} className={ghostButton}>
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!industryKey || !sizeKey}
                    onClick={() => setStep(2)}
                    className="flex-1 rounded-xl bg-halo px-5 py-2.5 font-semibold text-void shadow-[0_0_32px_-6px_rgba(143,162,255,0.8)] transition enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40 disabled:shadow-none"
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <form action={action} className={`space-y-4 rounded-3xl p-5 sm:p-8 ${glass}`}>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Create your account</h1>
                <p className="-mt-2 mb-2 text-muted">You will be the Super Administrator of your organization.</p>
                <input type="hidden" name="categoryKey" value={categoryKey} />
                <input type="hidden" name="industryKey" value={industryKey} />
                <input type="hidden" name="sizeKey" value={sizeKey} />
                <Field label="Organization name" id="orgName" required autoFocus {...bind("orgName")} />
                <Field label="Your full name" id="adminName" autoComplete="name" required {...bind("adminName")} />
                <Field label="Your email" id="email" type="email" autoComplete="username" required {...bind("email")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password (10+ characters)" id="password" type="password" autoComplete="new-password" minLength={10} required />
                  <Field label="Confirm password" id="confirm" type="password" autoComplete="new-password" minLength={10} required />
                </div>
                {state?.error && <Alert kind="error">{state.error}</Alert>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className={ghostButton}>
                    Back
                  </button>
                  <div className="flex-1">
                    <SubmitButton pending={pending}>Register organization</SubmitButton>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition active:scale-[0.98] ${glass} ${
        selected
          ? "border-photon bg-photon/15 ring-2 ring-photon/40 shadow-[0_0_28px_-6px_rgba(143,162,255,0.7)]"
          : "hover:border-photon/50 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
