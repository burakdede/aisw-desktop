import { invoke } from "@tauri-apps/api/core";
import { listen, type Event } from "@tauri-apps/api/event";
import type { AsyncDispose } from "./async-dispose";
import type { ErrorMetadata } from "./error-details";
import type { UnknownRecord } from "./parse-guards";
import {
  DESKTOP_RUNTIME_WAIT_INTERVAL_MS,
  DESKTOP_RUNTIME_WAIT_TIMEOUT_MS,
} from "./desktop-timing";

export class DesktopCommandError extends Error {
  kind?: ErrorMetadata["kind"];
  remediation?: ErrorMetadata["remediation"];

  constructor(message: string, options?: ErrorMetadata) {
    super(message);
    this.name = "DesktopCommandError";
    this.kind = options?.kind;
    this.remediation = options?.remediation;
  }
}

export function isDesktopRuntimeUnavailableError(error: unknown) {
  return error instanceof DesktopCommandError && error.kind === "runtime_unavailable";
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __AISW_DESKTOP_MOCK__?: UnknownRecord | ((cmd: string, args?: unknown) => unknown);
    __AISW_DESKTOP_LISTEN__?: <T>(
      event: string,
      handler: (payload: T) => void,
    ) => Promise<AsyncDispose> | AsyncDispose;
  }
}

export function hasDesktopRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.__TAURI_INTERNALS__);
}

export async function invokeDesktop<T>(command: string, args?: UnknownRecord) {
  try {
    if (typeof window !== "undefined" && window.__AISW_DESKTOP_MOCK__) {
      const mock = window.__AISW_DESKTOP_MOCK__;
      if (typeof mock === "function") {
        return (await mock(command, args)) as T;
      }
      return mock[command] as T;
    }

    if (!(await waitForDesktopRuntime())) {
      throw desktopRuntimeUnavailableError();
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

  if (!(await waitForDesktopRuntime())) {
    return () => {};
  }

  return listen(event, (payload: Event<T>) => {
    handler(payload.payload);
  });
}

async function waitForDesktopRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  if (hasDesktopRuntime()) {
    return true;
  }

  const timeoutAt = Date.now() + DESKTOP_RUNTIME_WAIT_TIMEOUT_MS;
  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => window.setTimeout(resolve, DESKTOP_RUNTIME_WAIT_INTERVAL_MS));
    if (hasDesktopRuntime()) {
      return true;
    }
  }

  return hasDesktopRuntime();
}

function desktopRuntimeUnavailableError() {
  return new DesktopCommandError("AI Switcher desktop runtime is unavailable.", {
    kind: "runtime_unavailable",
    remediation:
      "Launch AI Switcher with `npm run tauri:dev` or open the packaged desktop app instead of the standalone Vite page.",
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
