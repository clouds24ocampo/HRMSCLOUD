"use client";

import { useEffect, useState } from "react";
import { checkLocationLink, createLocationLink } from "@/app/(app)/locate/actions";

// Shown on a computer: a QR code the person scans with their own phone (signed in as themselves). The phone sends its GPS fix,
// and `onReady` hands the one-time token to the time clock, which uses it for the next stamp.
export function PhoneLocation({ onReady, onClose }: { onReady: (token: string, accuracy: number) => void; onClose: () => void }) {
  const [link, setLink] = useState<{ token: string; url: string; qr: string } | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    createLocationLink().then((l) => live && setLink(l)).catch(() => live && setError("Could not make a link. Reload the page and try again."));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!link) return;
    const t = setInterval(async () => {
      const r = await checkLocationLink(link.token).catch(() => null);
      if (r) {
        clearInterval(t);
        onReady(link.token, r.accuracy);
      }
    }, 2000);
    const stop = setTimeout(() => clearInterval(t), 10 * 60_000); // the link expires after 10 minutes
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [link, onReady]);

  return (
    <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Confirm your location with your phone</p>
          <p className="mt-1 text-xs text-muted">Computers have no GPS. Scan this with your phone&apos;s camera, sign in as yourself if asked, and press “Send my phone&apos;s location”. This page continues on its own.</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">Close</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {link ? (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made on our server; nothing to optimize */}
          <img src={link.qr} width={220} height={220} alt="QR code to open on your phone" className="rounded-xl bg-white p-2" />
          <p className="min-w-0 flex-1 break-all text-xs text-muted">Or open on your phone: <span className="font-mono text-ink">{link.url}</span><span className="mt-2 block animate-pulse">Waiting for your phone…</span></p>
        </div>
      ) : !error && <p className="mt-3 text-sm text-muted">Making a link…</p>}
    </div>
  );
}
