"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="font-semibold">We could not load this page.</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink">
        Try again
      </button>
    </div>
  );
}
