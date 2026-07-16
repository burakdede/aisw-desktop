export const COMPACT_SIDEBAR_BREAKPOINT = 880;

export const APP_FRAME_MODES = {
  standard: "standard",
  setup: "setup",
} as const;

export type AppFrameMode = (typeof APP_FRAME_MODES)[keyof typeof APP_FRAME_MODES];

export const APP_FRAME_COPY = {
  closeSidebarLabel: "Close sidebar",
  hideSidebarLabel: "Hide sidebar",
  showSidebarLabel: "Show sidebar",
  primaryNavAriaLabel: "Primary",
  setupKicker: "Welcome",
} as const;

export type AppFrameNavItem = {
  id: string;
  disabled?: boolean;
};

export type AppFrameNavDirection = "next" | "previous" | "first" | "last";

export function isCompactSidebarWidth(width: number) {
  return width < COMPACT_SIDEBAR_BREAKPOINT;
}

export function defaultSidebarOpen(width: number) {
  return !isCompactSidebarWidth(width);
}

export function appFrameNavDirectionForKey(
  key: string,
  hasModifier: boolean,
): AppFrameNavDirection | null {
  if (hasModifier) {
    return null;
  }

  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return "next";
    case "ArrowUp":
    case "ArrowLeft":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

export function orderedAppFrameNavItems(items: AppFrameNavItem[]) {
  return items.filter((item) => !item.disabled);
}

export function nextAppFrameNavItemId(
  currentId: string,
  items: AppFrameNavItem[],
  direction: AppFrameNavDirection,
) {
  const orderedItems = orderedAppFrameNavItems(items);
  if (!orderedItems.length) {
    return null;
  }

  const currentIndex = orderedItems.findIndex((item) => item.id === currentId);
  if (currentIndex === -1) {
    return null;
  }

  const targetIndex =
    direction === "first"
      ? 0
      : direction === "last"
        ? orderedItems.length - 1
        : direction === "next"
          ? Math.min(currentIndex + 1, orderedItems.length - 1)
          : Math.max(currentIndex - 1, 0);

  return orderedItems[targetIndex]?.id ?? null;
}
