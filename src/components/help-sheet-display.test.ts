import { describe, expect, it } from "vitest";
import {
  HELP_SHEET_ACTIONS,
  HELP_SHEET_COPY,
  HELP_SHEET_SHORTCUTS,
  HELP_SHEET_SUPPORTED_TOOLS,
} from "./help-sheet-display";

describe("help-sheet-display", () => {
  it("shares help sheet copy, supported tools, shortcuts, and actions", () => {
    expect(HELP_SHEET_COPY.dialogAriaLabel).toBe("Using AI Switch");
    expect(HELP_SHEET_COPY.heading).toBe("Using AI Switch");
    expect(HELP_SHEET_COPY.supportedToolsAriaLabel).toBe("Supported tools");
    expect(HELP_SHEET_COPY.nextStepsHeading).toBe("Open the right surface");

    expect(HELP_SHEET_SUPPORTED_TOOLS).toEqual(["claude", "codex", "gemini"]);
    expect(HELP_SHEET_SHORTCUTS).toEqual([
      { label: "Quick Switch", shortcut: "⌘K" },
      { label: "Diagnostics", shortcut: "⌘4" },
      { label: "Settings", shortcut: "⌘," },
    ]);
    expect(HELP_SHEET_ACTIONS).toEqual([
      { id: "profiles", label: "Open Profiles" },
      { id: "diagnostics", label: "Open Diagnostics" },
      { id: "settings", label: "Open Settings" },
    ]);
  });
});
