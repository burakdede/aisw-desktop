import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from "./layout";
import {
  clearPersistedWindowState,
  syncWindowState,
  WINDOW_STATE_STORAGE_KEY,
} from "./window-state";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  clear: () => void;
  removeItem: (key: string) => void;
};

type WindowMock = NonNullable<Window["__AISW_WINDOW_MOCK__"]>;

function createStorageMock(seed: Record<string, string> = {}): StorageMock {
  const state = new Map(Object.entries(seed));
  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => {
      state.set(key, value);
    },
    clear: () => {
      state.clear();
    },
    removeItem: (key) => {
      state.delete(key);
    },
  };
}

function createWindowMock() {
  let resizeHandler: (() => void) | undefined;
  let moveHandler: (() => void) | undefined;
  const setSize = vi.fn().mockResolvedValue(undefined);
  const setPosition = vi.fn().mockResolvedValue(undefined);
  const mockWindow: WindowMock = {
    setSize,
    setPosition,
    innerSize: vi.fn().mockResolvedValue({ width: 1360.4, height: 860.2 }),
    outerPosition: vi.fn().mockResolvedValue({ x: 180.4, y: 144.6 }),
    isMaximized: vi.fn().mockResolvedValue(false),
    onResized: vi.fn(async (handler: () => void) => {
      resizeHandler = handler;
      return () => {
        resizeHandler = undefined;
      };
    }),
    onMoved: vi.fn(async (handler: () => void) => {
      moveHandler = handler;
      return () => {
        moveHandler = undefined;
      };
    }),
  };

  return {
    mockWindow,
    setSize,
    setPosition,
    triggerResize: () => resizeHandler?.(),
    triggerMove: () => moveHandler?.(),
  };
}

describe("window-state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock(),
    });
    delete window.__AISW_WINDOW_MOCK__;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.__AISW_WINDOW_MOCK__;
  });

  it("restores a persisted frame and clamps undersized dimensions", async () => {
    const { mockWindow, setSize, setPosition } = createWindowMock();
    window.localStorage.setItem(
      WINDOW_STATE_STORAGE_KEY,
      JSON.stringify({ width: 800, height: 600, x: 64, y: 96 }),
    );
    window.__AISW_WINDOW_MOCK__ = mockWindow;

    const dispose = await syncWindowState();

    expect(setSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: MIN_WINDOW_WIDTH, height: MIN_WINDOW_HEIGHT }),
    );
    expect(setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 64, y: 96 }));

    dispose();
  });

  it("ignores malformed persisted state", async () => {
    const { mockWindow, setSize, setPosition } = createWindowMock();
    window.localStorage.setItem(
      WINDOW_STATE_STORAGE_KEY,
      JSON.stringify({ width: "bad", height: 600, x: 64, y: 96 }),
    );
    window.__AISW_WINDOW_MOCK__ = mockWindow;

    const dispose = await syncWindowState();

    expect(setSize).not.toHaveBeenCalled();
    expect(setPosition).not.toHaveBeenCalled();

    dispose();
  });

  it("persists the latest geometry after move and resize events", async () => {
    const { mockWindow, triggerMove, triggerResize } = createWindowMock();
    window.__AISW_WINDOW_MOCK__ = mockWindow;

    const dispose = await syncWindowState();

    triggerResize();
    triggerMove();
    await vi.advanceTimersByTimeAsync(220);

    expect(window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY)).toBe(
      JSON.stringify({ width: 1360, height: 860, x: 180, y: 145 }),
    );

    dispose();
  });

  it("skips persistence while the native window is maximized", async () => {
    const { mockWindow, triggerResize } = createWindowMock();
    mockWindow.isMaximized = vi.fn().mockResolvedValue(true);
    window.__AISW_WINDOW_MOCK__ = mockWindow;

    const dispose = await syncWindowState();

    triggerResize();
    await vi.advanceTimersByTimeAsync(220);

    expect(window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY)).toBeNull();

    dispose();
  });

  it("clears persisted state without throwing", () => {
    window.localStorage.setItem(WINDOW_STATE_STORAGE_KEY, "{\"width\":1}");

    expect(() => clearPersistedWindowState()).not.toThrow();
    expect(window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY)).toBeNull();
  });
});
