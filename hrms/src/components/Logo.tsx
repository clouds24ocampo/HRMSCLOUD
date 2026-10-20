// The HRMS mark: an "H" with a person's head between its pillars, on an indigo badge.
// Same artwork as src/app/icon.svg (the browser tab icon); keep the two in step. Colors are fixed, not currentColor.
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="hrms-logo-g" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#hrms-logo-g)" />
      <g fill="#fff">
        <rect x="6" y="7" width="4.6" height="18" rx="2.3" />
        <rect x="21.4" y="7" width="4.6" height="18" rx="2.3" />
        <rect x="9" y="18.2" width="14" height="3.6" rx="1.8" />
        <circle cx="16" cy="10.6" r="2.7" />
      </g>
    </svg>
  );
}
