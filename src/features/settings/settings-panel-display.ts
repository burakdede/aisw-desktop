import type { AppBootstrap, DesktopSettings } from "../../lib/schemas";
import { DEFAULT_ACTION_FAILURE_MESSAGE, NOT_FOUND_LABEL, NOT_SET_LABEL } from "../../lib/display-copy";
import { DesktopCommandError } from "../../lib/tauri";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

export const LAUNCH_AT_LOGIN_ENABLED_MESSAGE = "Launch at login enabled.";
export const LAUNCH_AT_LOGIN_DISABLED_MESSAGE = "Launch at login disabled.";
export const WINDOW_LAYOUT_RESET_MESSAGE = "Cleared the saved window size and position.";

export function formatSettingsMutationError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return {
      message: normalizeRuntimeLanguage(error.message),
      remediation: normalizeRuntimeLanguage(error.remediation),
    };
  }
  if (error instanceof Error) {
    return {
      message: normalizeRuntimeLanguage(error.message),
      remediation: undefined,
    };
  }
  return {
    message: DEFAULT_ACTION_FAILURE_MESSAGE,
    remediation: undefined,
  };
}

export function findShellHookCheck(report: Record<string, unknown> | undefined) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  for (const entry of checks) {
    const check = entry as { name?: string; status?: string; detail?: string };
    if (!check.name?.toLowerCase().includes("shell")) {
      continue;
    }
    return {
      status:
        check.status === "pass" || check.status === "warn" || check.status === "fail"
          ? check.status
          : "warn",
      detail: normalizeTerminalIntegrationText(check.detail ?? ""),
    };
  }
  return null;
}

export function effectiveRuntimePath(
  runtimeKind: DesktopSettings["runtime_kind"],
  runtimePath: string,
) {
  return runtimeKind === "custom" ? runtimePath : "";
}

export function selectedRuntimePath(
  settings: DesktopSettings,
  runtimeStatus: AppBootstrap["runtime_status"],
) {
  if (settings.runtime_kind === "custom") {
    return settings.runtime_path ?? NOT_SET_LABEL;
  }
  if (settings.runtime_kind === "system") {
    return runtimeStatus.inventory?.system_path ?? NOT_FOUND_LABEL;
  }
  return runtimeStatus.inventory?.bundled_path ?? NOT_FOUND_LABEL;
}
