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
      <rect x="4" y="4" width="24" height="24" rx="8.5" className="brand-mark-panel" />
      <rect x="6.5" y="6.5" width="19" height="19" rx="6.75" className="brand-mark-panel-secondary" />
      <rect x="10.15" y="8.85" width="3.5" height="14.3" rx="1.75" className="brand-mark-rail" />
      <rect x="18.35" y="8.85" width="3.5" height="14.3" rx="1.75" className="brand-mark-rail" />
      <path
        d="M12 11.25H16C18.3472 11.25 20.25 13.1528 20.25 15.5C20.25 17.8472 18.3472 19.75 16 19.75H12"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5H20"
        className="brand-mark-flow"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.25" r="2.05" className="brand-mark-node" />
      <circle cx="20" cy="15.5" r="2.3" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="12" cy="19.75" r="2.05" className="brand-mark-node" />
      <path d="M11.55 10.85H14.95" className="brand-mark-highlight" strokeWidth="0.82" strokeLinecap="round" />
      <path
        d="M11.55 19.35H14.95"
        className="brand-mark-highlight brand-mark-highlight-soft"
        strokeWidth="0.82"
        strokeLinecap="round"
      />
    </svg>
  );
}
