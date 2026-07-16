import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_SECTION,
  normalizeSettingsSection,
  settingsSectionLabel,
  SETTINGS_SECTION_IDS,
  SETTINGS_SECTION_LABELS,
  SETTINGS_SECTIONS,
} from "./settings-sections";

describe("settings-sections", () => {
  it("shares settings section ids and order", () => {
    expect(SETTINGS_SECTION_IDS).toEqual({
      general: "general",
      runtime: "runtime",
      shell: "shell",
      keyring: "keyring",
      updates: "updates",
      advanced: "advanced",
    });
    expect(SETTINGS_SECTIONS).toEqual([
      "general",
      "runtime",
      "shell",
      "keyring",
      "updates",
      "advanced",
    ]);
    expect(DEFAULT_SETTINGS_SECTION).toBe("general");
    expect(SETTINGS_SECTION_LABELS).toEqual({
      general: "General",
      runtime: "Engine",
      shell: "Terminal Integration",
      keyring: "Security",
      updates: "Updates",
      advanced: "Advanced",
    });
    expect(settingsSectionLabel("runtime")).toBe("Engine");
    expect(normalizeSettingsSection("runtime")).toBe("runtime");
    expect(normalizeSettingsSection("bad")).toBe("general");
    expect(normalizeSettingsSection("bad", "updates")).toBe("updates");
  });
});
