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
      <rect x="2.75" y="2.75" width="26.5" height="26.5" rx="9.75" className="brand-mark-shell" />
      <rect x="4.2" y="4.2" width="23.6" height="23.6" rx="8.8" className="brand-mark-core" />
      <path d="M8.4 8.85H23.6" className="brand-mark-highlight" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M9.35 9.8C11.25 11.15 13.4 12.95 15.7 15.25L18.5 18.05C19.85 19.4 21.25 20.55 22.65 21.45"
        className="brand-mark-ribbon"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.35 22.2C11.25 20.85 13.4 19.05 15.7 16.75L18.5 13.95C19.85 12.6 21.25 11.45 22.65 10.55"
        className="brand-mark-flow"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.3 10.55H22.65V13.9"
        className="brand-mark-flow"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.3 21.45H22.65V18.1"
        className="brand-mark-flow"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.45" cy="16" r="1.35" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="16" cy="16" r="1.25" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="21.55" cy="16" r="1.35" className="brand-mark-node brand-mark-node-soft" />
    </svg>
  );
}
