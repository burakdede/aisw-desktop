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
      <path
        d="M8.2 9.4C8.2 8.18497 9.18497 7.2 10.4 7.2H21.6C22.815 7.2 23.8 8.18497 23.8 9.4V22.6C23.8 23.815 22.815 24.8 21.6 24.8H10.4C9.18497 24.8 8.2 23.815 8.2 22.6V9.4Z"
        className="brand-mark-plate"
      />
      <rect x="10.15" y="10.15" width="4.7" height="11.7" rx="2.35" className="brand-mark-lane" />
      <rect
        x="17.15"
        y="10.15"
        width="4.7"
        height="11.7"
        rx="2.35"
        className="brand-mark-lane brand-mark-lane-accent"
      />
      <path
        d="M12.5 12.7C12.5 15.85 14.45 17.3 17.1 17.3H19.5"
        className="brand-mark-path"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 19.35C19.5 16.2 17.55 14.75 14.9 14.75H12.5"
        className="brand-mark-path brand-mark-path-accent"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.95 16.02H17.08" className="brand-mark-bridge" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12.5" cy="12.7" r="1.8" className="brand-mark-node" />
      <circle cx="19.5" cy="19.35" r="2.05" className="brand-mark-node brand-mark-node-accent" />
      <path
        d="M9.3 8.75H22.7"
        className="brand-mark-highlight"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
