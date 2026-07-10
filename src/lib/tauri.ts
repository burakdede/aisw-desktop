import { invoke } from "@tauri-apps/api/core";
import { listen, type Event } from "@tauri-apps/api/event";

export class DesktopCommandError extends Error {
  kind?: string;
  remediation?: string;

  constructor(message: string, options?: { kind?: string; remediation?: string }) {
    super(message);
    this.name = "DesktopCommandError";
    this.kind = options?.kind;
    this.remediation = options?.remediation;
  }
}

export type TrayCommandResultEvent =
  | {
      scope: "tool";
      tool: string;
      label: string;
      status: "success" | "error";
      message: string;
      kind?: string;
      remediation?: string;
    }
  | {
      scope: "global";
      id: string;
      label: string;
      status: "success" | "error";
      message: string;
      kind?: string;
      remediation?: string;
    };

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
  try {
    if (typeof window !== "undefined" && window.__AISW_DESKTOP_MOCK__) {
      const mock = window.__AISW_DESKTOP_MOCK__;
      if (typeof mock === "function") {
        return (await mock(command, args)) as T;
      }
      return mock[command] as T;
    }

    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeDesktopError(error);
  }
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

function normalizeDesktopError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return error;
  }
  if (error instanceof Error) {
    return new DesktopCommandError(error.message);
  }
  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error && typeof error.message === "string"
      ? error.message
      : "Desktop command failed.";
    const maybeKind = "kind" in error && typeof error.kind === "string" ? error.kind : undefined;
    const maybeRemediation =
      "remediation" in error && typeof error.remediation === "string"
        ? error.remediation
        : undefined;
    return new DesktopCommandError(maybeMessage, {
      kind: maybeKind,
      remediation: maybeRemediation,
    });
  }
  return new DesktopCommandError("Desktop command failed.");
}
