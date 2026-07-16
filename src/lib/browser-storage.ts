export type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "clear" | "removeItem">;

export function resolveBrowserStorage(
  fallback: BrowserStorage | null = null,
): BrowserStorage | null {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return window.localStorage ?? fallback;
  } catch {
    return fallback;
  }
}
