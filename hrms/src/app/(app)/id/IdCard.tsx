/* eslint-disable @next/next/no-img-element -- private pictures behind a signed-in route; the image optimizer cannot fetch them */
export type IdCardData = {
  org: string; orgInitials: string; title: string; footer: string | null; logoUrl: string | null; address: string | null;
  name: string; displayName: string; employeeNo: string | null; position: string | null; category: string | null; department: string | null; hireDate: string | null;
  photoUrl: string | null;
  contact: { address: string | null; phone: string | null; email: string | null }; birthDate: string | null;
  gov: { label: string; value: string | null }[]; govMasked: boolean; // numbers for the back; masked unless the viewer is the owner or HR
  terms: string[]; issuedOn: string | null; expiresOn: string | null;
  signatory: { name: string | null; title: string | null; signatureUrl: string | null };
  qr: string; // data: URL of the QR code that opens this person's profile
};

// The colors of the Philippine flag: royal blue, scarlet red, white, and the golden yellow of the sun and stars.
export const FLAG = { blue: "#0038A8", red: "#CE1126", yellow: "#FCD116", ink: "#0b1b4d" } as const;

const keep = "[-webkit-print-color-adjust:exact] [print-color-adjust:exact]";
const shell = `relative mx-auto aspect-[54/86] w-full max-w-[22rem] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/10 print:break-inside-avoid print:shadow-none ${keep}`;

// Eight short rays and a disc: the sun of the flag, used small.
function Sun({ size = 36 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" className="shrink-0">
      <g stroke={FLAG.yellow} strokeWidth="2.6" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={20 + Math.cos(a) * 12.5} y1={20 + Math.sin(a) * 12.5} x2={20 + Math.cos(a) * 18} y2={20 + Math.sin(a) * 18} />; })}
      </g>
      <circle cx="20" cy="20" r="8.5" fill={FLAG.yellow} />
    </svg>
  );
}

// The flag's own layout as a header: blue above, red below, split on a slant, with the white wedge at the hoist.
function FlagHeader({ height }: { height: string }) {
  return (
    <span aria-hidden className="absolute inset-x-0 top-0 overflow-hidden" style={{ height }}>
      <span className="absolute inset-0" style={{ background: FLAG.blue }} />
      <span className="absolute inset-x-0 bottom-0 h-[46%]" style={{ background: FLAG.red }} />
      <span className="absolute -left-[2%] top-0 h-full w-[38%]" style={{ background: "white", clipPath: "polygon(0 0, 100% 50%, 0 100%)", opacity: 0.12 }} />
      <span className="absolute inset-x-0 bottom-[46%] h-[3px]" style={{ background: FLAG.yellow }} />
    </span>
  );
}

function Stripe() {
  return (
    <span aria-hidden className="absolute inset-x-0 bottom-0 flex h-2">
      <span className="flex-1" style={{ background: FLAG.blue }} /><span className="flex-1 bg-white" /><span className="flex-1" style={{ background: FLAG.red }} /><span className="w-6" style={{ background: FLAG.yellow }} />
    </span>
  );
}

function Logo({ d, size }: { d: IdCardData; size: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow ring-2 ring-white/60`}>
      {d.logoUrl ? <img src={d.logoUrl} alt={`${d.org} logo`} className="h-full w-full object-contain" /> : <span aria-hidden className="text-lg font-extrabold" style={{ color: FLAG.blue }}>{d.orgInitials}</span>}
    </span>
  );
}

export function IdCardFront({ d }: { d: IdCardData }) {
  const rows = [
    d.employeeNo && { label: "ID #", value: d.employeeNo },
    d.department && { label: "Department", value: d.department },
    d.contact.address && { label: "Address", value: d.contact.address },
    d.contact.phone && { label: "Phone #", value: d.contact.phone },
    d.contact.email && { label: "Email", value: d.contact.email },
    d.birthDate && { label: "Birth date", value: d.birthDate },
    d.hireDate && { label: "Date hired", value: d.hireDate },
  ].filter((r): r is { label: string; value: string } => !!r);
  return (
    <article aria-label={`Front of the ID of ${d.name}`} className={shell}>
      <FlagHeader height="40%" />
      <div className="relative flex h-full flex-col px-5 pb-5 pt-4">
        <div className="flex items-center gap-3 text-white">
          <Logo d={d} size="h-14 w-14" />
          <p className="min-w-0 font-serif text-[1.15rem] font-black uppercase leading-[1.05] tracking-wide">{d.org}</p>
        </div>
        {d.address && <p className="mt-1.5 text-center text-[8px] font-medium uppercase leading-snug tracking-wide text-white/90">{d.address}</p>}

        <div className="mx-auto mt-3 h-[9.5rem] w-[8.5rem] shrink-0 overflow-hidden rounded-2xl border-[3px] bg-white shadow-xl ring-4 ring-white" style={{ borderColor: FLAG.yellow }}>
          {d.photoUrl ? <img src={d.photoUrl} alt={`Photo of ${d.name}`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs font-semibold text-slate-400" aria-label="No photo">No photo</span>}
        </div>

        <h2 className="mt-3 text-center font-serif text-[1.05rem] font-black uppercase leading-tight tracking-wide" style={{ color: FLAG.ink }}>{d.displayName}</h2>
        {d.position && <p className="mt-0.5 text-center text-[0.8rem] font-bold uppercase leading-tight tracking-[0.12em]" style={{ color: FLAG.blue }}>{d.position}</p>}
        {d.category && <p className="mx-auto mt-1.5 rounded-full px-3 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white" style={{ background: FLAG.red }}>{d.category}</p>}

        {rows.length > 0 && (
          <dl className="mt-3 space-y-1 text-left">
            {rows.map((r) => (
              <div key={r.label} className="flex gap-2 text-[0.68rem] leading-tight">
                <dt className="w-[4.2rem] shrink-0 font-bold uppercase tracking-wide" style={{ color: FLAG.blue }}>{r.label}</dt>
                <dd className="min-w-0 flex-1 break-words font-semibold text-slate-800">: {r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="text-[8px] text-slate-500">{d.footer}</p>
          <Sun size={30} />
        </div>
      </div>
      <Stripe />
    </article>
  );
}

export function IdCardBack({ d }: { d: IdCardData }) {
  return (
    <article aria-label={`Back of the ID of ${d.name}`} className={shell}>
      <FlagHeader height="26%" />
      <div className="relative flex h-full flex-col">
        <div className="flex flex-col items-center px-5 pt-4 text-center text-white">
          <Logo d={d} size="h-14 w-14" />
          <p className="mt-1.5 font-serif text-[1rem] font-black uppercase leading-tight tracking-wide">{d.org}</p>
        </div>

        <div className="px-6 pt-6">
          <h3 className="text-center text-[0.8rem] font-extrabold uppercase tracking-wide underline decoration-2 underline-offset-4" style={{ color: FLAG.blue, textDecorationColor: FLAG.yellow }}>Terms &amp; Conditions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.62rem] leading-snug text-slate-700">
            {d.terms.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>

        <div className="mx-5 mt-3 flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: `color-mix(in srgb, ${FLAG.blue} 25%, white)`, background: `color-mix(in srgb, ${FLAG.blue} 6%, white)` }}>
          <dl className="min-w-0 flex-1 space-y-1">
            {d.gov.map((g) => (
              <div key={g.label} className="flex gap-2 text-[0.68rem] leading-tight">
                <dt className="w-[5.2rem] shrink-0 font-bold uppercase tracking-wide" style={{ color: FLAG.blue }}>{g.label}</dt>
                <dd className="min-w-0 flex-1 font-semibold tabular-nums text-slate-800">: {g.value ?? <span className="font-normal text-slate-400">not added</span>}</dd>
              </div>
            ))}
            {d.govMasked && <p className="pt-0.5 text-[0.55rem] italic text-slate-500">Numbers are hidden for privacy.</p>}
          </dl>
          <img src={d.qr} alt="QR code: scan to open this employee's profile" width={72} height={72} className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-lg bg-white p-1 ring-1 ring-slate-200" />
        </div>

        <div className="relative mt-auto overflow-hidden rounded-t-[2.25rem] px-5 pb-6 pt-4 text-center text-white" style={{ background: FLAG.blue }}>
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: FLAG.red }} />
          <span aria-hidden className="absolute inset-x-0 bottom-[42%] h-[3px]" style={{ background: FLAG.yellow }} />
          <div className="relative">
            {d.signatory.signatureUrl && <img src={d.signatory.signatureUrl} alt="Signature" className="mx-auto -mb-1 h-11 max-w-40 object-contain brightness-0 invert" />}
            <p className="text-[0.85rem] font-extrabold uppercase leading-tight tracking-wide">{d.signatory.name ?? "Authorized signatory"}</p>
            {d.signatory.title && <p className="text-[0.62rem] font-semibold text-white/90">({d.signatory.title})</p>}
            <p className="mt-2.5 text-[0.68rem] font-extrabold uppercase tracking-wide">ID date issued: {d.issuedOn ?? <span className="font-medium normal-case opacity-80">not issued yet</span>}</p>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-wide">ID expiration: {d.expiresOn ?? <span className="font-medium normal-case opacity-80">not issued yet</span>}</p>
          </div>
        </div>
      </div>
      <Stripe />
    </article>
  );
}

// Both sides. The page decides what is shown (from the HR design) and builds the QR code.
export function IdCard({ d, className = "grid gap-6 md:grid-cols-2" }: { d: IdCardData; className?: string }) {
  return (
    <div className={className}>
      <div><p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted print:hidden">Front</p><IdCardFront d={d} /></div>
      <div><p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted print:hidden">Back</p><IdCardBack d={d} /></div>
    </div>
  );
}
