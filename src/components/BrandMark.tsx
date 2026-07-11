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
      <path
        d="M11.5 10.25H18.9C21.1644 10.25 23 12.0856 23 14.35C23 16.6144 21.1644 18.45 18.9 18.45H13.6"
        className="brand-mark-track"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 21.75H13.1C10.8356 21.75 9 19.9144 9 17.65C9 15.3856 10.8356 13.55 13.1 13.55H18.4"
        className="brand-mark-track brand-mark-track-accent"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="9" y="9" width="6.1" height="3.5" rx="1.75" className="brand-mark-switch" />
      <rect x="16.9" y="19.5" width="6.1" height="3.5" rx="1.75" className="brand-mark-switch brand-mark-switch-accent" />
      <circle cx="11.1" cy="10.75" r="0.9" className="brand-mark-switch-dot" />
      <circle cx="20.9" cy="21.25" r="0.9" className="brand-mark-switch-dot brand-mark-switch-dot-accent" />
      <path
        d="M15.5 15.95H18.65"
        className="brand-mark-bridge"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.35 16.05H16.5"
        className="brand-mark-bridge brand-mark-bridge-accent"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
