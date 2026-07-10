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
        d="M11 9.5C11 8.67157 11.6716 8 12.5 8H13.5C14.3284 8 15 8.67157 15 9.5V22.5C15 23.3284 14.3284 24 13.5 24H12.5C11.6716 24 11 23.3284 11 22.5V9.5Z"
        className="brand-mark-lane"
      />
      <path
        d="M17 9.5C17 8.67157 17.6716 8 18.5 8H19.5C20.3284 8 21 8.67157 21 9.5V22.5C21 23.3284 20.3284 24 19.5 24H18.5C17.6716 24 17 23.3284 17 22.5V9.5Z"
        className="brand-mark-lane brand-mark-lane-accent"
      />
      <path
        d="M12.75 12.5H19.25C20.7688 12.5 22 13.7312 22 15.25C22 16.7688 20.7688 18 19.25 18H12.75C11.2312 18 10 19.2312 10 20.75C10 22.2688 11.2312 23.5 12.75 23.5H19.25"
        className="brand-mark-stroke"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 10.5L22 10.5"
        className="brand-mark-stroke brand-mark-stroke-accent"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="20.75" r="1.6" className="brand-mark-node" />
      <circle cx="22" cy="10.5" r="1.6" className="brand-mark-node brand-mark-node-accent" />
      <path
        d="M19.75 8.25L22 10.5L19.75 12.75"
        className="brand-mark-stroke brand-mark-stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
