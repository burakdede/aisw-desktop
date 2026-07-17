import { describe, expect, it } from "vitest";
import { eventTargetIsEditable, eventTargetWithinSelector } from "./dom-events";

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

  it("detects editable event targets for shortcut guards", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const contentEditable = document.createElement("div");
    Object.defineProperty(contentEditable, "isContentEditable", {
      configurable: true,
      value: true,
    });
    const button = document.createElement("button");

    expect(eventTargetIsEditable(input)).toBe(true);
    expect(eventTargetIsEditable(textarea)).toBe(true);
    expect(eventTargetIsEditable(select)).toBe(true);
    expect(eventTargetIsEditable(contentEditable)).toBe(true);
    expect(eventTargetIsEditable(button)).toBe(false);
    expect(eventTargetIsEditable(window)).toBe(false);
    expect(eventTargetIsEditable(null)).toBe(false);
  });
});
