import { readViewportWidth } from "../lib/viewport-size";

export function measuredPaneWidth(
  element: HTMLDivElement | null,
  fallbackWidth: number,
) {
  if (!element) {
    return readViewportWidth(fallbackWidth);
  }

  const width = element.getBoundingClientRect().width;
  if (width > 0) {
    return width;
  }

  return readViewportWidth(fallbackWidth);
}
