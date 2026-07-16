import { afterEach, describe, expect, it } from "vitest";
import { resolveBrowserStorage, type BrowserStorage } from "./browser-storage";

function createStorageMock(): BrowserStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    clear: () => {
      values.clear();
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

describe("resolveBrowserStorage", () => {
  afterEach(() => {
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
    }
  });

  it("returns localStorage when available", () => {
    const storage = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });

    expect(resolveBrowserStorage()).toBe(storage);
  });

  it("returns the fallback when localStorage access throws", () => {
    const fallback = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    expect(resolveBrowserStorage(fallback)).toBe(fallback);
  });

  it("returns null when no fallback is provided and localStorage access throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    expect(resolveBrowserStorage()).toBeNull();
  });
});
