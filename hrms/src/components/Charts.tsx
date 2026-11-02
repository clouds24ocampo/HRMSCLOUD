// Small dependency-free SVG charts. Colors come from the theme tokens so light and dark both work.
export function Bars({ data, unit = "", height = 140, tone = "brand" }: { data: { label: string; value: number }[]; unit?: string; height?: number; tone?: "brand" | "warning" | "danger" | "success" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const fill = { brand: "var(--brand)", warning: "var(--warning)", danger: "var(--danger)", success: "var(--success)" }[tone];
  return (
    <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}${unit}`).join(", ")} className="h-36 w-full">
      <line x1="0" x2="100" y1={height / 4 - 0.2} y2={height / 4 - 0.2} stroke="var(--line)" strokeWidth="0.4" />
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 4 - 4);
        return <rect key={d.label} x={i * w + w * 0.15} y={height / 4 - h} width={w * 0.7} height={Math.max(h, d.value ? 0.6 : 0)} rx="0.8" fill={fill} opacity={d.value ? 0.9 : 0.15}><title>{`${d.label}: ${d.value}${unit}`}</title></rect>;
      })}
    </svg>
  );
}

export function Meter({ value, tone }: { value: number | null; tone: "success" | "warning" | "danger" | "neutral" }) {
  const color = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", neutral: "var(--muted)" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value ?? 0)}%`, background: color }} />
    </div>
  );
}

// Column bars where every column opens the list behind it. Plain HTML so each column is a real link.
export function LinkBars({ data, unit = "" }: { data: { label: string; value: number; href: string }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-36 items-end gap-px" role="list">
      {data.map((d) => (
        <a key={d.label} href={d.href} role="listitem" title={`${d.label}: ${d.value}${unit}. Click to see who.`} aria-label={`${d.label}: ${d.value}${unit}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
          <span className="block w-full rounded-t-sm bg-brand transition group-hover:bg-brand/70" style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : "2px", opacity: d.value ? 0.9 : 0.2 }} />
        </a>
      ))}
    </div>
  );
}
