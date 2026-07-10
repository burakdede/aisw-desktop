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
      <rect x="3" y="6" width="18" height="20" rx="9" className="brand-mark-panel" />
      <rect x="11" y="6" width="18" height="20" rx="9" className="brand-mark-panel brand-mark-panel-accent" />
      <path
        d="M11 16H21"
        className="brand-mark-stroke"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 11L21 16L16 21"
        className="brand-mark-stroke"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
