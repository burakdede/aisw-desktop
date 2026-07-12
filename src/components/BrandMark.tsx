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
      <path d="M9.2 9H22.8" className="brand-mark-highlight" strokeWidth="1.05" strokeLinecap="round" />

      <rect x="8.15" y="7.55" width="5.7" height="16.9" rx="2.85" className="brand-mark-dock" />
      <rect x="18.15" y="7.55" width="5.7" height="16.9" rx="2.85" className="brand-mark-dock" />

      <circle cx="11" cy="11.35" r="1.45" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="11" cy="20.65" r="1.45" className="brand-mark-node brand-mark-node-muted" />
      <circle cx="21" cy="11.35" r="1.45" className="brand-mark-node brand-mark-node-muted" />
      <circle cx="21" cy="20.65" r="1.45" className="brand-mark-node brand-mark-node-accent" />

      <path
        d="M13.5 11.35L18.35 16L13.5 20.65"
        className="brand-mark-switch"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.75 16H17.25"
        className="brand-mark-switch-shadow"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="1.15" className="brand-mark-joint" />
    </svg>
  );
}
