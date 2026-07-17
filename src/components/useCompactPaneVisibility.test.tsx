import { act, renderHook } from "@testing-library/react";
import { useCompactPaneVisibility } from "./useCompactPaneVisibility";

describe("useCompactPaneVisibility", () => {
  it("keeps both panes visible outside compact mode", () => {
    const { result, rerender } = renderHook(
      ({ compactLayout }) => useCompactPaneVisibility(compactLayout),
      { initialProps: { compactLayout: false } },
    );

    expect(result.current.compactPaneOpen).toBe(false);
    expect(result.current.showPrimary).toBe(true);
    expect(result.current.showSecondary).toBe(true);

    act(() => {
      result.current.setCompactPaneOpen(true);
    });

    expect(result.current.compactPaneOpen).toBe(false);
    expect(result.current.showPrimary).toBe(true);
    expect(result.current.showSecondary).toBe(true);

    rerender({ compactLayout: true });

    expect(result.current.compactPaneOpen).toBe(false);
    expect(result.current.showPrimary).toBe(true);
    expect(result.current.showSecondary).toBe(false);

    act(() => {
      result.current.setCompactPaneOpen(true);
    });

    expect(result.current.compactPaneOpen).toBe(true);
    expect(result.current.showPrimary).toBe(false);
    expect(result.current.showSecondary).toBe(true);
  });

  it("resets the compact pane when compact mode turns off", () => {
    const { result, rerender } = renderHook(
      ({ compactLayout }) => useCompactPaneVisibility(compactLayout),
      { initialProps: { compactLayout: true } },
    );

    act(() => {
      result.current.setCompactPaneOpen(true);
    });

    expect(result.current.compactPaneOpen).toBe(true);
    expect(result.current.showPrimary).toBe(false);
    expect(result.current.showSecondary).toBe(true);

    rerender({ compactLayout: false });

    expect(result.current.compactPaneOpen).toBe(false);
    expect(result.current.showPrimary).toBe(true);
    expect(result.current.showSecondary).toBe(true);
  });
});
