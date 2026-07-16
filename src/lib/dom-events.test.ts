import { describe, expect, it } from "vitest";
import { eventTargetWithinSelector } from "./dom-events";

describe("dom-events", () => {
  it("detects when an event target is inside the requested selector", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "menu-root";
    const button = document.createElement("button");
    wrapper.appendChild(button);
    document.body.appendChild(wrapper);

    expect(eventTargetWithinSelector(button, ".menu-root")).toBe(true);
    expect(eventTargetWithinSelector(button, ".missing-root")).toBe(false);
  });

  it("rejects non-element event targets", () => {
    expect(eventTargetWithinSelector(window, ".menu-root")).toBe(false);
    expect(eventTargetWithinSelector(null, ".menu-root")).toBe(false);
  });
});
