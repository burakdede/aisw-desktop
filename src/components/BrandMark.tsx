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
      <rect x="4" y="4" width="24" height="24" rx="9" className="brand-mark-panel" />
      <path
        d="M9.5 8.5C9.5 7.94772 9.94772 7.5 10.5 7.5H21.5C22.0523 7.5 22.5 7.94772 22.5 8.5V23.5C22.5 24.0523 22.0523 24.5 21.5 24.5H10.5C9.94772 24.5 9.5 24.0523 9.5 23.5V8.5Z"
        className="brand-mark-panel-secondary"
      />
      <path
        d="M11.75 10.5C11.75 9.5335 12.5335 8.75 13.5 8.75H18.5C19.4665 8.75 20.25 9.5335 20.25 10.5V16C20.25 16.9665 19.4665 17.75 18.5 17.75H13.5C12.5335 17.75 11.75 16.9665 11.75 16V10.5Z"
        className="brand-mark-panel-accent"
      />
      <path
        d="M11.75 21C13.3816 19.9844 14.7969 19.4766 16 19.4766C17.3359 19.4766 18.75 19.9844 20.2422 21"
        className="brand-mark-flow"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.25 22.5C14.5 21.75 15.4167 21.375 16 21.375C16.5833 21.375 17.5 21.75 18.75 22.5"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11.5H18"
        className="brand-mark-flow"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 14.25H17"
        className="brand-mark-flow"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="11.75" cy="21" r="1.75" className="brand-mark-node" />
      <circle cx="20.25" cy="21" r="1.75" className="brand-mark-node brand-mark-node-accent" />
      <path
        d="M16 17.75V21"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
