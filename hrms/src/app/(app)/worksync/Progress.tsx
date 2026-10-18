// A thin progress bar. The number next to it is always written out as text too, so colour is never the only signal.
export function Progress({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress" className={`h-2 overflow-hidden rounded-full bg-line ${className}`}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}
