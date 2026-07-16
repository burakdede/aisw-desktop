import { describe, expect, it, vi } from "vitest";
import { readViewportHeight, readViewportWidth } from "./viewport-size";

describe("viewport-size", () => {
  it("uses the live viewport when the window is available", () => {
    expect(readViewportWidth(800)).toBe(window.innerWidth);
    expect(readViewportHeight(600)).toBe(window.innerHeight);
  });

  it("falls back when the window object is unavailable", () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    try {
      expect(readViewportWidth(800)).toBe(800);
      expect(readViewportHeight(600)).toBe(600);
    } finally {
      if (windowDescriptor) {
        Object.defineProperty(globalThis, "window", windowDescriptor);
      } else {
        vi.unstubAllGlobals();
      }
    }
  });
});
