import { describe, expect, it } from "vitest";
import {
  duplicateProfileNameWarning,
  profileCompactSummary,
  profileCredentialBackendLabel,
  profileImportModeHeading,
  profileImportModeLabel,
  profileImportModeNotes,
} from "./profile-sheet-display";

describe("profile-sheet-display", () => {
  it("shares profile import mode labels and headings", () => {
    expect(profileImportModeLabel("from_live")).toBe("Import current login");
    expect(profileImportModeLabel("oauth")).toBe("Sign in with OAuth");
    expect(profileImportModeHeading("claude", "from_live")).toBe(
      "Import current Claude Code login",
    );
    expect(profileImportModeHeading("codex", "oauth")).toBe("Sign in to Codex CLI");
  });

  it("shares profile import mode notes", () => {
    expect(profileImportModeNotes("claude", "from_live")).toEqual([
      "Capture the Claude Code credentials already active on this Mac.",
    ]);
    expect(profileImportModeNotes("gemini", "from_env")).toEqual([
      "Read GEMINI_API_KEY from the current environment when you save this profile.",
    ]);
    expect(profileImportModeNotes("codex", "api_key")[0]).toContain(
      "without storing it in the form state",
    );
  });

  it("shares backend, compact summary, and duplicate warning text", () => {
    expect(profileCredentialBackendLabel("auto")).toBe("Automatic");
    expect(profileCompactSummary({ tool: "claude", state: "live_mismatch" })).toBe(
      "Claude Code · Needs Attention",
    );
    expect(duplicateProfileNameWarning("codex", "personal")).toBe(
      "Codex already has a profile named personal. Choose a different name or rename the existing profile first.",
    );
  });
});
