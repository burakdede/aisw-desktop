import { APP_NAV_IDS, APP_NAV_LABELS } from "../lib/app-navigation";
import { DESKTOP_ACTION_COPY } from "../lib/desktop-action-copy";
import { CLOSE_LABEL } from "../lib/display-copy";
import { SUPPORTED_TOOLS, type SupportedTool } from "../lib/tool-registry";

export const HELP_SHEET_COPY = {
  dialogAriaLabel: "Using AI Switch",
  kicker: "Help",
  heading: "Using AI Switch",
  intro:
    "AI Switch keeps account switching local to this computer and focused on profile changes, verification, and recovery.",
  closeLabel: CLOSE_LABEL,
  supportedToolsKicker: "Supported tools",
  supportedToolsHeading: "Desktop control center",
  supportedToolsAriaLabel: "Supported tools",
  supportedToolsPrimaryNote:
    "Credentials stay on this Mac. No telemetry or prompt proxying is used.",
  supportedToolsSecondaryNote:
    "Use Profiles to save accounts, Quick Switch to move fast, and Diagnostics when something drifts.",
  shortcutsKicker: "Shortcuts",
  shortcutsHeading: "Fast navigation",
  nextStepsKicker: "Next steps",
  nextStepsHeading: "Open the right surface",
  nextStepsNote:
    "Go to Profiles to save or import accounts, Diagnostics to verify switching health, or Settings to review app setup and terminal integration.",
} as const;

export const HELP_SHEET_SUPPORTED_TOOLS: readonly SupportedTool[] = SUPPORTED_TOOLS;

export const HELP_SHEET_SHORTCUTS = [
  {
    label: DESKTOP_ACTION_COPY.quickSwitchLabel,
    shortcut: DESKTOP_ACTION_COPY.quickSwitchShortcut,
  },
  {
    label: APP_NAV_LABELS[APP_NAV_IDS.diagnostics],
    shortcut: DESKTOP_ACTION_COPY.diagnosticsShortcut,
  },
  {
    label: APP_NAV_LABELS[APP_NAV_IDS.settings],
    shortcut: DESKTOP_ACTION_COPY.settingsShortcut,
  },
] as const;

export const HELP_SHEET_ACTIONS = [
  { id: APP_NAV_IDS.profiles, label: DESKTOP_ACTION_COPY.openProfilesLabel },
  { id: APP_NAV_IDS.diagnostics, label: DESKTOP_ACTION_COPY.openDiagnosticsLabel },
  { id: APP_NAV_IDS.settings, label: DESKTOP_ACTION_COPY.openSettingsLabel },
] as const;
