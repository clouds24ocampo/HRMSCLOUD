// Company logo: Quantum Cloud Corporation heraldic crest.
// Same artwork as src/app/icon.png and favicon.ico; keep the assets in step.
export function Logo({
  className = "h-7 w-7",
  alt = "Quantum Cloud Corporation Logo",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static unoptimized local asset for immediate display
    <img
      src="/logo.png"
      alt={alt}
      width={128}
      height={128}
      className={`inline-block shrink-0 rounded object-contain ${className}`}
    />
  );
}
