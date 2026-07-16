import { APP_NAV_SHORTCUT_LABELS, APP_NAV_IDS } from "./app-navigation";

export const DESKTOP_ACTION_COPY = {
  quickSwitchLabel: "Quick Switch",
  quickSwitchShortcut: "⌘K",
  verifyLabel: "Verify",
  addProfileLabel: "Add Profile",
  addProfileEllipsisLabel: "Add Profile…",
  openProfilesLabel: "Open Profiles",
  openDiagnosticsLabel: "Open Diagnostics",
  openSettingsLabel: "Open Settings",
  diagnosticsShortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.diagnostics] ?? "⌘4",
  settingsShortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.settings] ?? "⌘,",
} as const;
