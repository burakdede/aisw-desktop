import { describe, expect, it } from "vitest";
import {
  APP_NAV_IDS,
  APP_NAV_SHORTCUT_KEYS,
  APP_NAV_SHORTCUT_LABELS,
  DEFAULT_APP_SECTIONS,
} from "./app-navigation";

describe("app-navigation", () => {
  it("shares app navigation ids and default sections", () => {
    expect(APP_NAV_IDS).toEqual({
      overview: "overview",
      profiles: "profiles",
      sets: "sets",
      diagnostics: "diagnostics",
      backups: "backups",
      activity: "activity",
      settings: "settings",
    });
    expect(DEFAULT_APP_SECTIONS).toEqual([
      "overview",
      "profiles",
      "sets",
      "diagnostics",
      "backups",
      "activity",
    ]);
  });

  it("shares app navigation shortcuts", () => {
    expect(APP_NAV_SHORTCUT_KEYS).toEqual({
      "1": "overview",
      "2": "profiles",
      "3": "sets",
      "4": "diagnostics",
      "5": "backups",
      "6": "activity",
    });
    expect(APP_NAV_SHORTCUT_LABELS).toEqual({
      overview: "⌘1",
      profiles: "⌘2",
      sets: "⌘3",
      diagnostics: "⌘4",
      backups: "⌘5",
      activity: "⌘6",
      settings: "⌘,",
    });
  });
});
