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
      <rect
        x="6.9"
        y="8.15"
        width="18.2"
        height="15.7"
        rx="5.6"
        className="brand-mark-plate"
      />
      <rect x="8.9" y="10.5" width="14.2" height="3.7" rx="1.85" className="brand-mark-track" />
      <rect x="16.25" y="10.5" width="6.85" height="3.7" rx="1.85" className="brand-mark-track-accent" />
      <rect x="8.9" y="17.85" width="14.2" height="3.7" rx="1.85" className="brand-mark-track" />
      <rect x="8.9" y="17.85" width="6.85" height="3.7" rx="1.85" className="brand-mark-track-accent" />
      <path
        d="M12.35 19.65C13.45 18.1 15 16.2 16 14.95C17.3 13.3 18.2 12.35 19.65 12.35"
        className="brand-mark-path"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.35 19.65C13.45 18.1 15 16.2 16 14.95C17.3 13.3 18.2 12.35 19.65 12.35"
        className="brand-mark-path-accent"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12.35" cy="19.65" r="2.05" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="19.65" cy="12.35" r="2.05" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="16" cy="14.95" r="1.15" className="brand-mark-node" />
      <path
        d="M8.35 9.8H23.65"
        className="brand-mark-highlight"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
