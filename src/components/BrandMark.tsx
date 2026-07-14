import brandMarkSrc from "../assets/brandmark-ui.png";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <img
      aria-hidden="true"
      alt=""
      className="brand-mark"
      src={brandMarkSrc}
      width={size}
      height={size}
      decoding="async"
    />
  );
}
