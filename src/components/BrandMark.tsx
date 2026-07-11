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
        d="M8 8.6C8 7.71635 8.71635 7 9.6 7H22.4C23.2837 7 24 7.71635 24 8.6V12.1C24 12.9837 23.2837 13.7 22.4 13.7H9.6C8.71635 13.7 8 12.9837 8 12.1V8.6Z"
        className="brand-mark-plate"
      />
      <rect x="9.25" y="8.85" width="5.15" height="14.35" rx="2.575" className="brand-mark-lane" />
      <rect x="17.6" y="8.85" width="5.15" height="14.35" rx="2.575" className="brand-mark-lane brand-mark-lane-accent" />
      <path
        d="M11.82 11.2V12.9C11.82 14.6924 13.2731 16.1455 15.0655 16.1455H16.9345C18.7269 16.1455 20.18 17.5986 20.18 19.391V20.8"
        className="brand-mark-path"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.18 20.8V19.15C20.18 17.3942 18.7568 15.971 17.001 15.971H15.18"
        className="brand-mark-path brand-mark-path-accent"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.7 15.98H18.3" className="brand-mark-bridge" strokeWidth="1.55" strokeLinecap="round" />
      <circle cx="11.82" cy="11.2" r="1.9" className="brand-mark-node" />
      <circle cx="20.18" cy="20.8" r="2.1" className="brand-mark-node brand-mark-node-accent" />
      <path
        d="M8.55 7.9H23.45"
        className="brand-mark-highlight"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}
