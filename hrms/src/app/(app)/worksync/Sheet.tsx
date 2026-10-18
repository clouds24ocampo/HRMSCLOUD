"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// A dialog over the page: the card (centered) or a side panel (People, Labels, Activity, Settings).
// It lives in the URL (?card=… / ?panel=…), so a card can be linked, the back button closes it, and it survives the 20-second refresh.
export function Sheet({ closeHref, label, side = false, children }: { closeHref: string; label: string; side?: boolean; children: ReactNode }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push(closeHref, { scroll: false }); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [router, closeHref]);

  return (
    <div className={`fixed inset-0 z-50 flex ${side ? "justify-end" : "items-start justify-center overflow-y-auto p-3 sm:p-8"}`}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={() => router.push(closeHref, { scroll: false })} className="fixed inset-0 cursor-default bg-ink/50 backdrop-blur-[2px]" />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative z-10 bg-surface shadow-2xl outline-none ${side ? "h-full w-full max-w-md overflow-y-auto p-5" : "my-auto w-full max-w-4xl rounded-2xl p-5 sm:p-7"}`}
      >
        <button type="button" onClick={() => router.push(closeHref, { scroll: false })} aria-label="Close" className="absolute right-3 top-3 rounded-lg px-2.5 py-1 text-xl text-muted transition hover:bg-bg hover:text-ink">×</button>
        {children}
      </div>
    </div>
  );
}
