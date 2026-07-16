import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DesktopCommandError,
  hasDesktopRuntime,
  invokeDesktop,
  listenDesktopEvent,
} from "./tauri";

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("tauri bridge", () => {
  beforeEach(() => {
    delete window.__TAURI_INTERNALS__;
    delete window.__AISW_DESKTOP_MOCK__;
    delete window.__AISW_DESKTOP_LISTEN__;
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects when the desktop runtime is available", () => {
    expect(hasDesktopRuntime()).toBe(false);
    window.__TAURI_INTERNALS__ = {};
    expect(hasDesktopRuntime()).toBe(true);
  });

  it("invokes desktop commands through the tauri bridge when available", async () => {
    window.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({ ok: true });

    await expect(invokeDesktop("get_bootstrap", { refresh: true })).resolves.toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledWith("get_bootstrap", { refresh: true });
  });

  it("returns a runtime unavailable error when tauri is missing", async () => {
    vi.useFakeTimers();

    const result = invokeDesktop("get_bootstrap");
    const assertion = expect(result).rejects.toMatchObject({
      name: "DesktopCommandError",
      kind: "runtime_unavailable",
      message: "AI Switcher desktop runtime is unavailable.",
    });

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("returns a no-op listener when tauri events are unavailable", async () => {
    vi.useFakeTimers();

    const disposerPromise = listenDesktopEvent("tray-open-overview", vi.fn());
    await vi.runAllTimersAsync();

    const disposer = await disposerPromise;
    expect(typeof disposer).toBe("function");
    expect(listenMock).not.toHaveBeenCalled();
    expect(() => disposer()).not.toThrow();
  });
});
