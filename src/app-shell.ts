import { DesktopCommandError } from "./lib/tauri";
import type { AppBootstrap } from "./lib/schemas";
export {
  runtimeSelectionLabel,
  runtimeSourceLabel,
} from "./lib/runtime-display";

export function settingsForRecovery(settings: AppBootstrap["settings"] | undefined) {
  return (
    settings ?? {
      runtime_kind: "bundled" as const,
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
    }
  );
}

export function navShortcutLabel(id: string) {
  switch (id) {
    case "overview":
      return "⌘1";
    case "profiles":
      return "⌘2";
    case "sets":
      return "⌘3";
    case "diagnostics":
      return "⌘4";
    case "backups":
      return "⌘5";
    case "activity":
      return "⌘6";
    case "settings":
      return "⌘,";
    default:
      return undefined;
  }
}

export function describeBootstrapError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return {
      message: error.message,
      remediation: error.remediation,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      remediation: undefined,
    };
  }

  return {
    message: "AI Switch could not load its local desktop state.",
    remediation: undefined,
  };
}

export function describeRuntimeBlocker(runtimeStatus: {
  resolved_path?: string | null;
  version?: unknown;
  capabilities?: unknown;
  issues: string[];
}) {
  const hasResolvedRuntime = Boolean(runtimeStatus.resolved_path);
  const missingDesktopContract =
    runtimeStatus.version == null ||
    runtimeStatus.capabilities == null ||
    runtimeStatus.issues.some(
      (issue) =>
        issue.includes("version info is unavailable") ||
        issue.includes("capabilities info is unavailable"),
    );

  if (hasResolvedRuntime && missingDesktopContract) {
    return {
      summary:
        "The current engine works outside the app, but it does not expose the desktop features AI Switch requires.",
      nextStep:
        "Use the included desktop engine, or choose a newer desktop-compatible engine in Engine Settings.",
    };
  }

  if (hasResolvedRuntime) {
    return {
      summary: "The current engine was found, but it is not compatible with this app.",
      nextStep:
        "Use the included desktop engine, or choose a compatible engine in Engine Settings.",
    };
  }

  return {
    summary: "AI Switch could not use the current desktop engine source.",
    nextStep:
      "Use the included desktop engine, or choose a working engine source in Engine Settings.",
  };
}

export function sectionTitle(section: string, setupFocused = false) {
  if (setupFocused) {
    return "Get started";
  }

  switch (section) {
    case "overview":
      return "Overview";
    case "profiles":
      return "Profiles";
    case "sets":
      return "Sets";
    case "diagnostics":
      return "Diagnostics";
    case "backups":
      return "Backups";
    case "activity":
      return "Activity";
    case "settings":
      return "Settings";
    default:
      return "AI Switch";
  }
}

export function sectionDetail(section: string, setupFocused = false) {
  if (setupFocused) {
    return "";
  }

  switch (section) {
    default:
      return "";
  }
}
