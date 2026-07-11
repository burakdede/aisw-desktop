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
      <rect x="4" y="4" width="24" height="24" rx="10" className="brand-mark-panel" />
      <path
        d="M9 11.25C9 9.45507 10.4551 8 12.25 8H18.75C20.5449 8 22 9.45507 22 11.25V16.5C22 18.2949 20.5449 19.75 18.75 19.75H12.25C10.4551 19.75 9 18.2949 9 16.5V11.25Z"
        className="brand-mark-panel-secondary"
      />
      <path
        d="M10 13.5C10 11.9812 11.2312 10.75 12.75 10.75H19.25C20.7688 10.75 22 11.9812 22 13.5V20.25C22 21.7688 20.7688 23 19.25 23H12.75C11.2312 23 10 21.7688 10 20.25V13.5Z"
        className="brand-mark-panel-accent"
      />
      <path
        d="M8.75 21.5C10.375 18.25 12.5833 16.625 15.375 16.625C17.625 16.625 19.1458 17.625 19.9375 19.625"
        className="brand-mark-flow"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11.5C13.4765 10.2917 14.9504 9.6875 16.4219 9.6875C18.5391 9.6875 20.3906 10.9948 21.9766 13.6094"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.25" cy="21.5" r="1.7" className="brand-mark-node" />
      <circle cx="21.75" cy="13.5" r="1.7" className="brand-mark-node brand-mark-node-accent" />
      <path
        d="M18.5 18.375L20.5 19.625L18.9688 21.5625"
        className="brand-mark-flow brand-mark-flow-accent"
        strokeWidth="1.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
