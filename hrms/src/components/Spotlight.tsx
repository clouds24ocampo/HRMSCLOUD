"use client";

import type { ReactNode } from "react";

// Glass card with a soft light that follows the cursor.
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(280px circle at var(--x, 50%) var(--y, 0%), rgba(143,162,255,0.2), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
