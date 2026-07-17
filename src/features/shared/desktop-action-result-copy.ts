import { titleCase } from "../../lib/utils";

export const DESKTOP_ACTION_RESULT_COPY = {
  labels: {
    addProfile: "Add profile",
    useProfile: "Use profile",
    switchProfile: "Switch profile",
    switchAllTools: "Switch all tools",
    useSet: "Use set",
    activateSavedSet: "Activate saved set",
    reapplyActiveProfile: "Re-apply active profile",
    renameProfile: "Rename profile",
    removeProfile: "Remove profile",
    restoreBackup: "Restore backup",
    updateSettings: "Update settings",
    runSetup: "Run setup",
    saveProjectRule: "Save project rule",
    removeProjectRule: "Remove project rule",
    updateProjectRuleGuard: "Update project rule guard",
    useExpectedProjectSet: "Use expected project set",
  },
  fallbackMessages: {
    addApiKeyProfile: "Failed to add API key profile.",
    settingsSaved: "Saved AI Switch settings.",
    setupComplete: "Finished setup scan.",
    projectSwitchTitle: "Project switch",
  },
} as const;

export function desktopActionFailureMessage(label: string) {
  return `${label} failed.`;
}

export function addProfileSavedMessage(tool: string, profile: string) {
  return `Saved ${tool} profile ${profile}.`;
}

export function switchProfileMessage(tool: string, label: string | null | undefined, profile: string) {
  return `Switched ${titleCase(tool)} to ${label ?? profile}.`;
}

export function switchAllToolsMessage(label: string | null | undefined, profile: string) {
  return `Switched all tools to ${label ?? profile}.`;
}

export function activatedSetMessage(label: string | null | undefined, context: string) {
  return `Activated set ${label ?? context}.`;
}

export function activatedSavedSetMessage(label: string | null | undefined, name: string) {
  return `Activated saved set ${label ?? name}.`;
}

export function renameProfileMessage(tool: string, oldName: string, newName: string) {
  return `Renamed ${tool} profile ${oldName} to ${newName}.`;
}

export function removeProfileMessage(tool: string, profile: string) {
  return `Removed ${tool} profile ${profile}.`;
}

export function restoreBackupMessage(backupId: string) {
  return `Restored backup ${backupId}.`;
}

export function savedProjectRuleMessage(label: string | null | undefined, context: string) {
  return `Saved project rule for ${label ?? context}.`;
}

export function removedProjectRuleMessage() {
  return "Removed project rule.";
}

export function updatedProjectRuleGuardMessage(mode: string) {
  return `Updated project rule guard to ${mode}.`;
}

export function switchedWorkspaceTargetMessage(
  targetLabel: string,
  matchedTarget: string,
) {
  return `Switched to ${targetLabel} for ${matchedTarget}.`;
}
