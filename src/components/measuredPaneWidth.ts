export function measuredPaneWidth(
  element: HTMLDivElement | null,
  fallbackWidth: number,
) {
  if (!element) {
    return typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
  }

  const width = element.getBoundingClientRect().width;
  if (width > 0) {
    return width;
  }

  return typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
}
