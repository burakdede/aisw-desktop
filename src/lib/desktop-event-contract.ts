import { DESKTOP_DIAGNOSTIC_QUERY_KEYS as SHARED_DESKTOP_DIAGNOSTIC_QUERY_KEYS } from "./desktop-query-keys";

export const DESKTOP_MENU_EVENTS = {
  openSettings: "menu-open-settings",
  openSettingsUpdates: "menu-open-settings-updates",
  openProfiles: "menu-open-profiles",
  openAddProfile: "menu-open-add-profile",
  openImportCurrentLogin: "menu-open-import-current-login",
  openOverview: "menu-open-overview",
  openSets: "menu-open-sets",
  openDiagnostics: "menu-open-diagnostics",
  runVerify: "menu-run-verify",
  openBackups: "menu-open-backups",
  openActivity: "menu-open-activity",
  openQuickSwitch: "menu-open-quick-switch",
  openHelp: "menu-open-help",
  exportDiagnostics: "menu-export-diagnostics",
  openTroubleshooting: "menu-open-troubleshooting",
  openIssues: "menu-open-issues",
  reapplyActiveProfile: "menu-reapply-active-profile",
} as const;

export const DESKTOP_TRAY_EVENTS = {
  openDiagnostics: "tray-open-diagnostics",
  runDiagnostics: "tray-run-diagnostics",
  commandResult: "tray-command-result",
} as const;

export const DESKTOP_DIAGNOSTIC_QUERY_KEYS = [
  ...SHARED_DESKTOP_DIAGNOSTIC_QUERY_KEYS,
] as const;

export const DESKTOP_EVENTS = {
  ...DESKTOP_MENU_EVENTS,
  ...DESKTOP_TRAY_EVENTS,
} as const;

export type DesktopEventName = (typeof DESKTOP_EVENTS)[keyof typeof DESKTOP_EVENTS];
