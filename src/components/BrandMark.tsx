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
      <path d="M8.8 8.65H23.2" className="brand-mark-highlight" strokeWidth="1" strokeLinecap="round" />

      <rect x="7.5" y="8.1" width="7.1" height="15.8" rx="3.55" className="brand-mark-lane-soft" />
      <rect x="17.4" y="8.1" width="7.1" height="15.8" rx="3.55" className="brand-mark-lane-strong" />

      <path
        d="M11.05 12.15C12.7 12.15 13.95 13.2 15.35 14.8L16 15.55C17.35 17.1 18.5 18.1 20.95 18.1"
        className="brand-mark-flow"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M20.95 18.1L18.9 16.05"
        className="brand-mark-flow"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.95 18.1L18.9 20.15"
        className="brand-mark-flow"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="11.05" cy="12.15" r="1.55" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="20.95" cy="18.1" r="1.55" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="11.05" cy="19.85" r="1.15" className="brand-mark-node brand-mark-node-muted" />
      <circle cx="20.95" cy="12.15" r="1.15" className="brand-mark-node brand-mark-node-muted" />
      <circle cx="16" cy="16" r="1.1" className="brand-mark-joint" />
    </svg>
  );
}
