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
      <path d="M8.1 8.6H23.9" className="brand-mark-highlight" strokeWidth="1" strokeLinecap="round" />
      <rect x="7.1" y="10.15" width="17.8" height="4.7" rx="2.35" className="brand-mark-lane-soft" />
      <rect x="7.1" y="17.15" width="17.8" height="4.7" rx="2.35" className="brand-mark-lane-soft" />
      <path
        d="M9.3 12.5H15.3"
        className="brand-mark-ribbon"
        strokeWidth="2.55"
        strokeLinecap="round"
      />
      <path
        d="M22.7 19.5H16.7"
        className="brand-mark-flow"
        strokeWidth="2.55"
        strokeLinecap="round"
      />
      <path
        d="M13.2 10.55L15.85 12.5L13.2 14.45"
        className="brand-mark-ribbon"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.8 17.55L16.15 19.5L18.8 21.45"
        className="brand-mark-flow"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 12.2V19.8"
        className="brand-mark-flow"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <circle cx="10.2" cy="12.5" r="1.45" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="21.8" cy="19.5" r="1.45" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="16" cy="16" r="3.25" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="16" cy="16" r="1.05" className="brand-mark-node brand-mark-node-core" />
    </svg>
  );
}
