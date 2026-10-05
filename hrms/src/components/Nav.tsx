"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import type { NavGroup, NavItem } from "@/lib/menu";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

// Desktop: grouped sidebar. Phone: four shortcuts plus a "More" sheet with everything.
export function Nav({ groups, primary }: { groups: NavGroup[]; primary: string[] }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const quick = primary.map((h) => all.find((i) => i.href === h)).filter((i): i is NavItem => !!i);

  return (
    <>
      <nav aria-label="Main" className="hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-4 md:flex">
        <p className="flex items-center gap-2 px-3 font-headline text-lg font-medium text-brand">
          <Logo className="h-6 w-6" /> HRMS
        </p>
        {groups.map((g, gi) => (
          <div key={g.title ?? gi} className="flex flex-col gap-0.5">
            {g.title && <p className="px-3 pb-1 text-xs font-medium text-muted">{g.title}</p>}
            {g.items.map((i) => {
              const active = isActive(path, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:text-ink aria-[current=page]:text-brand"
                >
                  {active && (
                    <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-brand/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  <span className="relative text-base" aria-hidden>{i.icon}</span>
                  <span className="relative">{i.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {quick.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(path, i.href) ? "page" : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted aria-[current=page]:text-brand"
          >
            <span className="text-xl" aria-hidden>{i.icon}</span>
            {i.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-haspopup="dialog"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted"
        >
          <span className="text-xl" aria-hidden>☰</span>
          More
        </button>
      </nav>

      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-30 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMore(false)} />
            <motion.div
              role="dialog"
              aria-label="All pages"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
              {groups.map((g, gi) => (
                <div key={g.title ?? gi} className="mb-4">
                  {g.title && <p className="mb-1 text-xs font-medium text-muted">{g.title}</p>}
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={() => setMore(false)}
                        aria-current={isActive(path, i.href) ? "page" : undefined}
                        className="flex flex-col items-center gap-1 rounded-xl border border-line p-3 text-center text-xs font-medium aria-[current=page]:border-brand aria-[current=page]:text-brand"
                      >
                        <span className="text-xl" aria-hidden>{i.icon}</span>
                        {i.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
