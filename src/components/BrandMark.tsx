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
      <rect x="8" y="7.5" width="7" height="17" rx="3.5" className="brand-mark-panel" />
      <rect x="17" y="7.5" width="7" height="17" rx="3.5" className="brand-mark-panel brand-mark-panel-accent" />
      <path
        d="M14 11.25C15.65 11.25 16.75 12.35 16.75 14V18C16.75 19.65 17.85 20.75 19.5 20.75"
        className="brand-mark-beam"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <circle cx="14" cy="11.25" r="1.85" className="brand-mark-node" />
      <circle cx="19.5" cy="20.75" r="1.85" className="brand-mark-node brand-mark-node-accent" />
    </svg>
  );
}
