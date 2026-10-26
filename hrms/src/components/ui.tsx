import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  // min-w-0: a wide table inside (it scrolls on its own) must never stretch a grid column past the screen.
  return <section className={`relative min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>{children}</section>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-line/60 text-muted",
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/10 text-danger",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: keyof typeof TONES }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{value}</p>
      {hint && <div className="mt-1"><Badge tone={tone}>{hint}</Badge></div>}
    </div>
  );
}

export const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm placeholder:text-muted focus:border-brand";
export const buttonClass =
  "rounded-lg bg-brand px-4 py-2.5 font-semibold text-brand-ink shadow-md shadow-brand/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60";
export const ghostClass = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95";
