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
      <rect x="4.4" y="4.4" width="23.2" height="23.2" rx="8.7" className="brand-mark-core" />
      <rect x="6.6" y="7.2" width="18.8" height="17.6" rx="6.4" className="brand-mark-plate" />
      <path d="M8.7 9.35H23.3" className="brand-mark-highlight" strokeWidth="1.05" strokeLinecap="round" />

      <rect x="8.5" y="10.2" width="15" height="4.15" rx="2.075" className="brand-mark-track" />
      <rect x="8.5" y="17.65" width="15" height="4.15" rx="2.075" className="brand-mark-track" />

      <circle cx="19.85" cy="12.275" r="3.1" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="12.15" cy="19.725" r="3.1" className="brand-mark-node brand-mark-node-accent" />

      <path
        d="M15.2 12.275H17.05"
        className="brand-mark-path"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M14.95 19.725H17.05"
        className="brand-mark-path"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M16 13.9V18.1"
        className="brand-mark-path-accent"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M16 13.9L17.75 15.6"
        className="brand-mark-path-accent"
        strokeWidth="1.28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 18.1L14.25 16.4"
        className="brand-mark-path-accent"
        strokeWidth="1.28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19.85" cy="12.275" r="1.08" className="brand-mark-node" />
      <circle cx="12.15" cy="19.725" r="1.08" className="brand-mark-node" />
    </svg>
  );
}
