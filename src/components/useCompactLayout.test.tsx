import { act, renderHook } from "@testing-library/react";
import { PANEL_COMPACT_BREAKPOINT } from "../lib/layout";
import { useCompactLayout } from "./useCompactLayout";

describe("useCompactLayout", () => {
  const resizeObserverOriginal = globalThis.ResizeObserver;

  afterEach(() => {
    vi.restoreAllMocks();
    if (resizeObserverOriginal) {
      globalThis.ResizeObserver = resizeObserverOriginal;
    } else {
      delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    }
  });

  it("returns compact mode when the pane is narrower than the breakpoint", () => {
    const ref = { current: null as HTMLDivElement | null };
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      width: 640,
      height: 0,
      x: 0,
      y: 0,
      top: 0,
      right: 640,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    });
    ref.current = element;

    const { result } = renderHook(() => useCompactLayout(ref, PANEL_COMPACT_BREAKPOINT));

    expect(result.current).toBe(true);
  });

  it("updates when the pane width changes", () => {
    const ref = { current: null as HTMLDivElement | null };
    const element = document.createElement("div");
    let width = 900;
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => ({
      width,
      height: 0,
      x: 0,
      y: 0,
      top: 0,
      right: width,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }));
    ref.current = element;

    const observe = vi.fn();
    const disconnect = vi.fn();
    class MockResizeObserver implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}

      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
      takeRecords = vi.fn(() => []);
    }
    globalThis.ResizeObserver = MockResizeObserver;

    const { result, unmount } = renderHook(() => useCompactLayout(ref, PANEL_COMPACT_BREAKPOINT));
    expect(result.current).toBe(false);

    act(() => {
      width = 700;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(true);
    expect(observe).toHaveBeenCalledWith(element);

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
