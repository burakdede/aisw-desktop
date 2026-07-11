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
      <rect x="4.5" y="4.5" width="23" height="23" rx="8.4" className="brand-mark-core" />
      <rect x="6.8" y="8" width="18.4" height="16" rx="5.8" className="brand-mark-plate" />
      <path d="M8.9 9.75H23.1" className="brand-mark-highlight" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="9" y="10.6" width="14" height="3.25" rx="1.625" className="brand-mark-track" />
      <rect x="9" y="18.15" width="14" height="3.25" rx="1.625" className="brand-mark-track" />
      <rect x="9" y="10.6" width="5.3" height="3.25" rx="1.625" className="brand-mark-track-accent" />
      <rect x="17.7" y="18.15" width="5.3" height="3.25" rx="1.625" className="brand-mark-track-accent" />
      <circle cx="11.65" cy="12.225" r="2.1" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="20.35" cy="19.775" r="2.1" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="11.65" cy="12.225" r="0.82" className="brand-mark-node" />
      <circle cx="20.35" cy="19.775" r="0.82" className="brand-mark-node" />
      <path
        d="M11.65 12.225H20.55"
        className="brand-mark-path"
        strokeWidth="1.95"
        strokeLinecap="round"
      />
      <path
        d="M18.45 10.175L20.55 12.225L18.45 14.275"
        className="brand-mark-path-accent"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.35 19.775H11.45"
        className="brand-mark-path"
        strokeWidth="1.95"
        strokeLinecap="round"
      />
      <path
        d="M13.55 17.725L11.45 19.775L13.55 21.825"
        className="brand-mark-path-accent"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
