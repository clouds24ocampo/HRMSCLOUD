"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps pages live: re-fetches server data every 20 s while the tab is visible, and right away when the tab regains focus.
// router.refresh() keeps client state (typed text, open rows, unlocked clock), so nothing the person is doing is lost.
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const go = () => { if (document.visibilityState === "visible" && navigator.onLine) router.refresh(); };
    const t = setInterval(go, seconds * 1000);
    document.addEventListener("visibilitychange", go);
    window.addEventListener("online", go);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", go);
      window.removeEventListener("online", go);
    };
  }, [router, seconds]);
  return null;
}
