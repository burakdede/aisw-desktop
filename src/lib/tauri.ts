import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __AISW_DESKTOP_MOCK__?: Record<string, unknown> | ((cmd: string, args?: unknown) => unknown);
  }
}

export async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.__AISW_DESKTOP_MOCK__) {
    const mock = window.__AISW_DESKTOP_MOCK__;
    if (typeof mock === "function") {
      return (await mock(command, args)) as T;
    }
    return mock[command] as T;
  }

  return invoke<T>(command, args);
}
