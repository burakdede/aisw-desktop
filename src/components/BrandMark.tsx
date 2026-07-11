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
      <rect x="3.5" y="3.5" width="25" height="25" rx="9" className="brand-mark-shell" />
      <rect x="7.5" y="7.5" width="17" height="17" rx="6.5" className="brand-mark-core" />
      <rect x="9.75" y="8.75" width="5.2" height="14.5" rx="2.6" className="brand-mark-lane" />
      <rect x="17.05" y="8.75" width="5.2" height="14.5" rx="2.6" className="brand-mark-lane brand-mark-lane-accent" />
      <path
        d="M12.35 11.25V13.05C12.35 14.7719 13.7461 16.168 15.468 16.168H17.05"
        className="brand-mark-path"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.65 20.75V18.95C19.65 17.2281 18.2539 15.832 16.532 15.832H14.95"
        className="brand-mark-path brand-mark-path-accent"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.2 15.95H17.8" className="brand-mark-bridge" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12.35" cy="11.25" r="1.7" className="brand-mark-node" />
      <circle cx="19.65" cy="20.75" r="1.7" className="brand-mark-node brand-mark-node-accent" />
    </svg>
  );
}
