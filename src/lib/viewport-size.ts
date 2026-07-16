export function readViewportWidth(fallbackWidth: number) {
  return typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
}

export function readViewportHeight(fallbackHeight: number) {
  return typeof window !== "undefined" ? window.innerHeight : fallbackHeight;
}
