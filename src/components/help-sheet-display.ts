import type { SupportedTool } from "../lib/tool-registry";

export const HELP_SHEET_COPY = {
  dialogAriaLabel: "Using AI Switch",
  kicker: "Help",
  heading: "Using AI Switch",
  intro:
    "AI Switch keeps account switching local to this computer and focused on profile changes, verification, and recovery.",
  closeLabel: "Close",
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

export const HELP_SHEET_SUPPORTED_TOOLS: readonly SupportedTool[] = [
  "claude",
  "codex",
  "gemini",
] as const;

export const HELP_SHEET_SHORTCUTS = [
  { label: "Quick Switch", shortcut: "⌘K" },
  { label: "Diagnostics", shortcut: "⌘4" },
  { label: "Settings", shortcut: "⌘," },
] as const;

export const HELP_SHEET_ACTIONS = [
  { id: "profiles", label: "Open Profiles" },
  { id: "diagnostics", label: "Open Diagnostics" },
  { id: "settings", label: "Open Settings" },
] as const;
