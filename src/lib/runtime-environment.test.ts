import { describe, expect, it } from "vitest";
import { hasDesktopRuntime, hasWindowObject } from "./runtime-environment";

describe("runtime-environment", () => {
  it("detects the browser window and desktop runtime bridge", () => {
    expect(hasWindowObject()).toBe(true);
    expect(hasDesktopRuntime()).toBe(false);
    window.__TAURI_INTERNALS__ = {};
    expect(hasDesktopRuntime()).toBe(true);
    delete window.__TAURI_INTERNALS__;
  });
});
