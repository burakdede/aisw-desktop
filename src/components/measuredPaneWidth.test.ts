import { measuredPaneWidth } from "./measuredPaneWidth";

describe("measuredPaneWidth", () => {
  it("uses the viewport width when no pane element is available", () => {
    expect(measuredPaneWidth(null, 800)).toBe(window.innerWidth);
  });

  it("uses the rendered pane width when it is available", () => {
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

    expect(measuredPaneWidth(element, 800)).toBe(640);
  });

  it("falls back to the viewport width when the pane reports zero width", () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    });

    expect(measuredPaneWidth(element, 800)).toBe(window.innerWidth);
  });
});
