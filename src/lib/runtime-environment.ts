export function hasWindowObject() {
  return typeof window !== "undefined";
}

export function hasDesktopRuntime() {
  return hasWindowObject() && Boolean(window.__TAURI_INTERNALS__);
}
