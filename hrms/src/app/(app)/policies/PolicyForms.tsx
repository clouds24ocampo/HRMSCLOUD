"use client";

import { useRef, useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { archivePolicy, publishPolicy, signPolicy } from "./actions";

export function PublishPolicyForm({ kinds }: { kinds: { value: string; label: string }[] }) {
  const f = useKeptForm(publishPolicy);
  return (
    <form {...f.formProps} encType="multipart/form-data" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" id="title" required maxLength={120} placeholder="Code of Conduct" />
        <label className="block text-sm font-medium">
          Kind
          <select name="kind" defaultValue="COMPANY_POLICY" className={inputClass}>
            {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        PDF file
        <input type="file" name="file" accept="application/pdf" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
      </label>
      <label className="block text-sm font-medium">
        …or the text of the policy
        <textarea name="body" rows={5} maxLength={50_000} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="requiresSignature" defaultChecked className="h-4 w-4 accent-brand" /> Every employee must sign it
      </label>
      <p className="text-xs text-muted">Using the title of a current policy publishes a new version: everyone signs again, and earlier signatures stay on record with the old version.</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Publish</SubmitButton>
    </form>
  );
}

export function ArchivePolicyButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => window.confirm("Archive this policy? Signatures stay on record.") && start(() => archivePolicy(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg disabled:opacity-60">
      Archive
    </button>
  );
}

// A drawn signature: mouse, pen or finger. Sent as a PNG with the typed name.
export function SignPolicyForm({ policyId, defaultName }: { policyId: string; defaultName: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const [sig, setSig] = useState("");
  const f = useKeptForm(signPolicy.bind(null, policyId));

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!drawn) setDrawn(true);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setSig(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
    setSig("");
  };

  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Your full name" id="signedName" required minLength={3} maxLength={120} defaultValue={defaultName} />
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Sign here</span>
          <button type="button" onClick={clear} className="text-sm text-muted hover:text-ink">Clear</button>
        </div>
        <canvas
          ref={canvas} width={600} height={200} aria-label="Signature box: draw your signature with a finger, pen or mouse" role="img"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          className="mt-1 h-40 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white"
        />
        <input type="hidden" name="signature" value={sig} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 accent-brand" />
        I have read this document in full, and I agree to it. I understand this electronic signature is as binding as my handwritten one.
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <button type="submit" disabled={f.pending || !drawn} className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-brand-ink shadow-md shadow-brand/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
        {f.pending ? "Signing…" : drawn ? "Sign" : "Draw your signature to sign"}
      </button>
    </form>
  );
}
