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
      <rect x="4.3" y="4.3" width="23.4" height="23.4" rx="8.6" className="brand-mark-core" />
      <path d="M9.25 11.1H22.75" className="brand-mark-highlight" strokeWidth="1.05" strokeLinecap="round" />

      <rect x="8.1" y="10.2" width="15.8" height="4.75" rx="2.375" className="brand-mark-track" />
      <rect x="8.1" y="17.05" width="15.8" height="4.75" rx="2.375" className="brand-mark-track" />

      <circle cx="12.35" cy="12.575" r="3.2" className="brand-mark-node brand-mark-node-soft" />
      <circle cx="19.65" cy="19.425" r="3.2" className="brand-mark-node brand-mark-node-accent" />

      <path
        d="M14.95 12.575H18.55"
        className="brand-mark-path"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M13.45 16.15L16 18.55L18.55 16.15"
        className="brand-mark-path-accent"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 13.55V18.3"
        className="brand-mark-path-accent"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12.35" cy="12.575" r="1.1" className="brand-mark-node-center" />
      <circle cx="19.65" cy="19.425" r="1.1" className="brand-mark-node-center brand-mark-node-center-accent" />
    </svg>
  );
}
