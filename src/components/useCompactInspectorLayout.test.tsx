import { act, renderHook } from "@testing-library/react";
import { PANEL_COMPACT_BREAKPOINT } from "../lib/layout";
import { useCompactInspectorLayout } from "./useCompactInspectorLayout";

describe("useCompactInspectorLayout", () => {
  const resizeObserverOriginal = globalThis.ResizeObserver;

  afterEach(() => {
    vi.restoreAllMocks();
    if (resizeObserverOriginal) {
      globalThis.ResizeObserver = resizeObserverOriginal;
    } else {
      delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    }
  });

  it("switches between primary and inspector panes in compact mode", () => {
    const ref = { current: null as HTMLDivElement | null };
    const element = document.createElement("div");
    let width = 700;
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

    class MockResizeObserver implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}

      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    }
    globalThis.ResizeObserver = MockResizeObserver;

    const { result } = renderHook(() => useCompactInspectorLayout(ref, PANEL_COMPACT_BREAKPOINT));

    expect(result.current.compactLayout).toBe(true);
    expect(result.current.compactInspectorOpen).toBe(false);
    expect(result.current.showPrimary).toBe(true);
    expect(result.current.showInspector).toBe(false);

    act(() => {
      result.current.setCompactInspectorOpen(true);
    });

    expect(result.current.compactInspectorOpen).toBe(true);
    expect(result.current.showPrimary).toBe(false);
    expect(result.current.showInspector).toBe(true);

    act(() => {
      width = 900;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.compactLayout).toBe(false);
    expect(result.current.compactInspectorOpen).toBe(false);
    expect(result.current.showPrimary).toBe(true);
    expect(result.current.showInspector).toBe(true);
  });
});
