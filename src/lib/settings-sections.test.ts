import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTION_IDS,
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
  });
});
