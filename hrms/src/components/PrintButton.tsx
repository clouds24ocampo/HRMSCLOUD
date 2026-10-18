"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:border-brand hover:text-brand transition"
    >
      🖨️ Print / Save PDF
    </button>
  );
}
