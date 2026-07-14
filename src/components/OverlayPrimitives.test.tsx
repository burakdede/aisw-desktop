import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnchoredMenu } from "./AnchoredMenu";
import { DialogSurface } from "./DialogSurface";

describe("AnchoredMenu", () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    cleanup();
  });

  it("positions the menu inside the containment boundary and exposes the boundary attribute", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "pane";
    document.body.appendChild(wrapper);

    const anchor = document.createElement("button");
    wrapper.appendChild(anchor);

    const anchorRef = { current: anchor } as RefObject<HTMLElement>;

    anchor.closest = vi.fn((selector?: string) =>
      selector === ".pane" ? wrapper : null,
    ) as typeof anchor.closest;
    anchor.getBoundingClientRect = vi.fn(() => ({
      x: 280,
      y: 120,
      left: 280,
      top: 120,
      right: 320,
      bottom: 144,
      width: 40,
      height: 24,
      toJSON: () => undefined,
    })) as typeof anchor.getBoundingClientRect;
    wrapper.getBoundingClientRect = vi.fn(() => ({
      x: 200,
      y: 80,
      left: 200,
      top: 80,
      right: 420,
      bottom: 340,
      width: 220,
      height: 260,
      toJSON: () => undefined,
    })) as typeof wrapper.getBoundingClientRect;

    render(
      <AnchoredMenu
        anchorRef={anchorRef}
        align="end"
        boundaryAttribute="data-menu-boundary"
        containmentSelector=".pane"
      >
        Menu
      </AnchoredMenu>,
    );

    const menu = document.body.querySelector(".anchored-menu-surface") as HTMLDivElement;
    expect(menu).not.toBeNull();

    menu.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 160,
      bottom: 120,
      width: 160,
      height: 120,
      toJSON: () => undefined,
    })) as typeof menu.getBoundingClientRect;

    fireEvent(window, new Event("resize"));

    expect(menu).toHaveAttribute("data-menu-boundary");
    expect(menu.style.left).toBe("208px");
    expect(menu.style.top).toBe("150px");
    expect(menu.style.opacity).toBe("1");
  });

  it("flips the menu above the anchor when there is not enough room below", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "pane";
    document.body.appendChild(wrapper);

    const anchor = document.createElement("button");
    wrapper.appendChild(anchor);

    const anchorRef = { current: anchor } as RefObject<HTMLElement>;

    anchor.closest = vi.fn(() => wrapper) as typeof anchor.closest;
    anchor.getBoundingClientRect = vi.fn(() => ({
      x: 340,
      y: 280,
      left: 340,
      top: 280,
      right: 372,
      bottom: 304,
      width: 32,
      height: 24,
      toJSON: () => undefined,
    })) as typeof anchor.getBoundingClientRect;
    wrapper.getBoundingClientRect = vi.fn(() => ({
      x: 200,
      y: 80,
      left: 200,
      top: 80,
      right: 420,
      bottom: 340,
      width: 220,
      height: 260,
      toJSON: () => undefined,
    })) as typeof wrapper.getBoundingClientRect;

    render(
      <AnchoredMenu anchorRef={anchorRef} align="start" containmentSelector=".pane">
        Menu
      </AnchoredMenu>,
    );

    const menu = document.body.querySelector(".anchored-menu-surface") as HTMLDivElement;
    menu.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 90,
      width: 100,
      height: 90,
      toJSON: () => undefined,
    })) as typeof menu.getBoundingClientRect;

    fireEvent(window, new Event("scroll"));

    expect(menu.style.left).toBe("312px");
    expect(menu.style.top).toBe("184px");
  });

  it("renders safely when the anchor ref is not attached", () => {
    const anchorRef = { current: null } as RefObject<HTMLElement>;

    render(<AnchoredMenu anchorRef={anchorRef}>Menu</AnchoredMenu>);

    expect(document.body.querySelector(".anchored-menu-surface")).toHaveTextContent("Menu");
  });
});

describe("DialogSurface", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    cleanup();
  });

  it("focuses the requested element and restores previous focus on unmount", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const { unmount } = render(
      <DialogSurface ariaLabel="Quick Switch" initialFocusSelector='input[name="search"]' onClose={onClose}>
        <input name="search" aria-label="Search" />
        <button type="button">Confirm</button>
      </DialogSurface>,
    );

    await waitFor(() => expect(screen.getByLabelText("Search")).toHaveFocus());

    unmount();

    expect(trigger).toHaveFocus();
  });

  it("closes from overlay clicks and Escape, but not from inside clicks", () => {
    const onClose = vi.fn();

    render(
      <DialogSurface ariaLabel="Profile actions" onClose={onClose}>
        <button type="button">Action</button>
      </DialogSurface>,
    );

    const overlay = document.querySelector(".quick-switch-overlay") as HTMLDivElement;
    const dialog = screen.getByRole("dialog", { name: "Profile actions" });

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("cycles focus within the panel when tabbing", () => {
    const onClose = vi.fn();

    render(
      <DialogSurface ariaLabel="Cycle focus" onClose={onClose}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </DialogSurface>,
    );

    const dialog = screen.getByRole("dialog", { name: "Cycle focus" });
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(second).toHaveFocus();

    second.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(first).toHaveFocus();

    second.focus();
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(second).toHaveFocus();
  });

  it("focuses the panel when no focusable children are available", () => {
    const onClose = vi.fn();

    render(
      <DialogSurface ariaLabel="Empty dialog" onClose={onClose}>
        <div>Nothing actionable</div>
      </DialogSurface>,
    );

    const dialog = screen.getByRole("dialog", { name: "Empty dialog" });
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(dialog).toHaveFocus();
  });

  it("moves focus to the first control when tabbing from the panel shell", () => {
    const onClose = vi.fn();

    render(
      <DialogSurface ariaLabel="Panel shell" onClose={onClose}>
        <button type="button">Primary</button>
        <button type="button">Secondary</button>
      </DialogSurface>,
    );

    const dialog = screen.getByRole("dialog", { name: "Panel shell" });
    const primary = screen.getByRole("button", { name: "Primary" });

    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(primary).toHaveFocus();
  });
});
