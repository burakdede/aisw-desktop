import { describe, expect, it } from "vitest";
import {
  activatedSavedSetMessage,
  activatedSetMessage,
  addProfileSavedMessage,
  DESKTOP_ACTION_RESULT_COPY,
  desktopActionFailureMessage,
  removeProfileMessage,
  removedProjectRuleMessage,
  renameProfileMessage,
  restoreBackupMessage,
  savedProjectRuleMessage,
  switchAllToolsMessage,
  switchedWorkspaceTargetMessage,
  switchProfileMessage,
  updatedProjectRuleGuardMessage,
} from "./desktop-action-result-copy";

describe("desktop-action-result-copy", () => {
  it("shares mutation labels and fallback copy", () => {
    expect(DESKTOP_ACTION_RESULT_COPY.labels.addProfile).toBe("Add profile");
    expect(DESKTOP_ACTION_RESULT_COPY.labels.useProfile).toBe("Use profile");
    expect(DESKTOP_ACTION_RESULT_COPY.labels.useSet).toBe("Use set");
    expect(DESKTOP_ACTION_RESULT_COPY.labels.reapplyActiveProfile).toBe(
      "Re-apply active profile",
    );
    expect(DESKTOP_ACTION_RESULT_COPY.labels.useExpectedProjectSet).toBe(
      "Use expected project set",
    );
    expect(DESKTOP_ACTION_RESULT_COPY.fallbackMessages.addApiKeyProfile).toBe(
      "Failed to add API key profile.",
    );
    expect(DESKTOP_ACTION_RESULT_COPY.fallbackMessages.projectSwitchTitle).toBe(
      "Project switch",
    );
    expect(desktopActionFailureMessage("Run setup")).toBe("Run setup failed.");
  });

  it("formats shared mutation success messages", () => {
    expect(addProfileSavedMessage("claude", "work")).toBe("Saved claude profile work.");
    expect(switchProfileMessage("claude", "Work", "work")).toBe("Switched Claude to Work.");
    expect(switchAllToolsMessage("Personal", "personal")).toBe(
      "Switched all tools to Personal.",
    );
    expect(activatedSetMessage("Research", "research")).toBe("Activated set Research.");
    expect(activatedSavedSetMessage("Daily", "daily")).toBe("Activated saved set Daily.");
    expect(renameProfileMessage("codex", "ops", "client-acme")).toBe(
      "Renamed codex profile ops to client-acme.",
    );
    expect(removeProfileMessage("gemini", "imported")).toBe(
      "Removed gemini profile imported.",
    );
    expect(restoreBackupMessage("backup-123")).toBe("Restored backup backup-123.");
    expect(savedProjectRuleMessage("Worktree", "worktree")).toBe(
      "Saved project rule for Worktree.",
    );
    expect(removedProjectRuleMessage()).toBe("Removed project rule.");
    expect(updatedProjectRuleGuardMessage("warn")).toBe(
      "Updated project rule guard to warn.",
    );
    expect(switchedWorkspaceTargetMessage("Daily", "~/project")).toBe(
      "Switched to Daily for ~/project.",
    );
  });
});
