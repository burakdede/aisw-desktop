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
      <rect x="4" y="4" width="24" height="24" rx="8.5" className="brand-mark-shell" />
      <rect x="7.75" y="7" width="6.5" height="18" rx="3.25" className="brand-mark-rail" />
      <rect x="17.75" y="7" width="6.5" height="18" rx="3.25" className="brand-mark-rail brand-mark-rail-accent" />
      <path
        d="M11 10.1C11 9.21635 11.7163 8.5 12.6 8.5C13.4837 8.5 14.2 9.21635 14.2 10.1V12.3C14.2 14.8405 16.2595 16.9 18.8 16.9H19.15C20.0337 16.9 20.75 17.6163 20.75 18.5C20.75 19.3837 20.0337 20.1 19.15 20.1H18.8C16.2595 20.1 14.2 22.1595 14.2 24.7V24.9C14.2 25.7837 13.4837 26.5 12.6 26.5C11.7163 26.5 11 25.7837 11 24.9V24.7C11 20.3922 14.4922 16.9 18.8 16.9C14.4922 16.9 11 13.4078 11 9.1V10.1Z"
        className="brand-mark-flow"
      />
      <path
        d="M12.6 16.9H19.4"
        className="brand-mark-beam"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12.6" cy="10.1" r="2.15" className="brand-mark-node" />
      <circle cx="19.4" cy="16.9" r="2.55" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="12.6" cy="24.9" r="2.15" className="brand-mark-node" />
    </svg>
  );
}
