import { invoke } from "@tauri-apps/api/core";
import { listen, type Event } from "@tauri-apps/api/event";

declare global {
  interface Window {
    __AISW_DESKTOP_MOCK__?: Record<string, unknown> | ((cmd: string, args?: unknown) => unknown);
    __AISW_DESKTOP_LISTEN__?: <T>(
      event: string,
      handler: (payload: T) => void,
    ) => Promise<() => void> | (() => void);
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

export async function listenDesktopEvent<T>(
  event: string,
  handler: (payload: T) => void,
) {
  if (typeof window !== "undefined" && window.__AISW_DESKTOP_LISTEN__) {
    return window.__AISW_DESKTOP_LISTEN__<T>(event, handler);
  }

  return listen(event, (payload: Event<T>) => {
    handler(payload.payload);
  });
}
