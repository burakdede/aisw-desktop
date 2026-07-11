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
        d="M11.25 9.75C11.25 8.7835 12.0335 8 13 8H19C19.9665 8 20.75 8.7835 20.75 9.75V10.25C20.75 11.2165 19.9665 12 19 12H13C12.0335 12 11.25 12.7835 11.25 13.75V14.25C11.25 15.2165 12.0335 16 13 16H19C19.9665 16 20.75 16.7835 20.75 17.75V18.25C20.75 19.2165 19.9665 20 19 20H13C12.0335 20 11.25 20.7835 11.25 21.75V22.25"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11.25" cy="9.75" r="2.25" className="brand-mark-node" />
      <circle cx="20.75" cy="14" r="2.25" className="brand-mark-node brand-mark-node-accent" />
      <circle cx="11.25" cy="22.25" r="2.25" className="brand-mark-node" />
      <path d="M13.75 10H18.2" className="brand-mark-highlight" strokeWidth="0.8" strokeLinecap="round" />
      <path
        d="M13.75 18H18.2"
        className="brand-mark-highlight brand-mark-highlight-soft"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
