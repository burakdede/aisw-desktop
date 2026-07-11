export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="24" height="24" rx="8.5" className="brand-mark-shell" />
      <rect x="6.25" y="6.25" width="19.5" height="19.5" rx="6.9" className="brand-mark-shell-inner" />
      <path
        d="M10.25 11.25H21.75"
        className="brand-mark-rail"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10.25 20.75H21.75"
        className="brand-mark-rail brand-mark-rail-accent"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12.25" cy="11.25" r="3.25" className="brand-mark-thumb" />
      <circle cx="19.75" cy="20.75" r="3.25" className="brand-mark-thumb brand-mark-thumb-accent" />
      <path
        d="M14.85 13.95L17.15 18.05"
        className="brand-mark-connector"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
