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
      <rect x="4.1" y="4.1" width="23.8" height="23.8" rx="8.9" className="brand-mark-core" />
      <path
        d="M8.9 12.4C10.7 10.35 13.2 9.2 16 9.2C18.85 9.2 21.25 10.28 23.1 12.5"
        className="brand-mark-ribbon"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23.05 19.55C21.2 21.75 18.72 22.85 15.9 22.85C13.18 22.85 10.72 21.8 8.9 19.65"
        className="brand-mark-flow"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.9 10.45L23.45 12.55L20.92 14.52"
        className="brand-mark-ribbon"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.1 17.48L8.55 19.58L11.08 21.55"
        className="brand-mark-flow"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 11.6V20.4" className="brand-mark-divider" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12.2" cy="12.35" r="1.35" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="19.75" cy="19.55" r="1.35" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="16" cy="16" r="3.45" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="16" cy="16" r="1.12" className="brand-mark-node brand-mark-node-core" />
    </svg>
  );
}
