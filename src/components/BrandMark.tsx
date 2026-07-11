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
      <rect x="4" y="4" width="24" height="24" rx="9" className="brand-mark-panel" />
      <rect x="7.5" y="7.5" width="17" height="17" rx="6.5" className="brand-mark-panel-secondary" />
      <rect x="9.5" y="8.75" width="4" height="14.5" rx="2" className="brand-mark-rail" />
      <rect x="18.5" y="8.75" width="4" height="14.5" rx="2" className="brand-mark-rail" />
      <path
        d="M11.5 12H20.5"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M20.5 20H11.5"
        className="brand-mark-flow"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="12" r="2.4" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="11.5" cy="20" r="2.4" className="brand-mark-node" />
      <path
        d="M13.5 12H18.1"
        className="brand-mark-highlight"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M18.4 20H13.9"
        className="brand-mark-highlight brand-mark-highlight-soft"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
