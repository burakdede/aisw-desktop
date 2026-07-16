import { describe, expect, it } from "vitest";
import {
  APP_FRAME_MODES,
  APP_FRAME_COPY,
  appFrameNavDirectionForKey,
  COMPACT_SIDEBAR_BREAKPOINT,
  defaultSidebarOpen,
  isCompactSidebarWidth,
  nextAppFrameNavItemId,
  orderedAppFrameNavItems,
} from "./app-frame-display";

describe("app-frame-display", () => {
  it("shares sidebar copy and breakpoint policy", () => {
    expect(COMPACT_SIDEBAR_BREAKPOINT).toBe(880);
    expect(APP_FRAME_MODES.standard).toBe("standard");
    expect(APP_FRAME_MODES.setup).toBe("setup");
    expect(APP_FRAME_COPY.closeSidebarLabel).toBe("Close sidebar");
    expect(APP_FRAME_COPY.hideSidebarLabel).toBe("Hide sidebar");
    expect(APP_FRAME_COPY.showSidebarLabel).toBe("Show sidebar");
    expect(APP_FRAME_COPY.primaryNavAriaLabel).toBe("Primary");
    expect(APP_FRAME_COPY.setupKicker).toBe("Welcome");
    expect(isCompactSidebarWidth(879)).toBe(true);
    expect(isCompactSidebarWidth(880)).toBe(false);
    expect(defaultSidebarOpen(879)).toBe(false);
    expect(defaultSidebarOpen(1200)).toBe(true);
  });

  it("shares keyboard navigation policy", () => {
    expect(appFrameNavDirectionForKey("ArrowDown", false)).toBe("next");
    expect(appFrameNavDirectionForKey("ArrowRight", false)).toBe("next");
    expect(appFrameNavDirectionForKey("ArrowUp", false)).toBe("previous");
    expect(appFrameNavDirectionForKey("ArrowLeft", false)).toBe("previous");
    expect(appFrameNavDirectionForKey("Home", false)).toBe("first");
    expect(appFrameNavDirectionForKey("End", false)).toBe("last");
    expect(appFrameNavDirectionForKey("ArrowDown", true)).toBeNull();
    expect(appFrameNavDirectionForKey("Enter", false)).toBeNull();
  });

  it("shares enabled-nav ordering and target resolution", () => {
    const items = [
      { id: "overview" },
      { id: "profiles" },
      { id: "sets", disabled: true },
      { id: "settings" },
    ];

    expect(orderedAppFrameNavItems(items)).toEqual([
      { id: "overview" },
      { id: "profiles" },
      { id: "settings" },
    ]);
    expect(nextAppFrameNavItemId("overview", items, "next")).toBe("profiles");
    expect(nextAppFrameNavItemId("profiles", items, "previous")).toBe("overview");
    expect(nextAppFrameNavItemId("overview", items, "first")).toBe("overview");
    expect(nextAppFrameNavItemId("overview", items, "last")).toBe("settings");
    expect(nextAppFrameNavItemId("missing", items, "next")).toBeNull();
    expect(nextAppFrameNavItemId("overview", [], "next")).toBeNull();
  });
});
