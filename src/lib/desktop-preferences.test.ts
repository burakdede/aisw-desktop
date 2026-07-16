import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_PREFERENCES,
  normalizeDefaultSection,
  normalizeDesktopAppearance,
} from "./desktop-preferences";

describe("desktop-preferences", () => {
  it("normalizes appearance and default section values", () => {
    expect(normalizeDesktopAppearance("dark")).toBe("dark");
    expect(normalizeDesktopAppearance("bad")).toBe(DEFAULT_DESKTOP_PREFERENCES.appearance);
    expect(normalizeDesktopAppearance("bad", "light")).toBe("light");
    expect(normalizeDefaultSection("profiles")).toBe("profiles");
    expect(normalizeDefaultSection("bad")).toBe(DEFAULT_DESKTOP_PREFERENCES.defaultSection);
    expect(normalizeDefaultSection("bad", "activity")).toBe("activity");
  });
});
