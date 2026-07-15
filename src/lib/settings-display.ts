import type { ShellHookGuidance } from "./schemas";
import { titleCase } from "./utils";

export const SHELL_CONFIG_UNAVAILABLE_LABEL = "Unavailable";
export const SHELL_COMPLETION_AVAILABLE_LABEL = "Available in this build";
export const SHELL_GUIDANCE_LOADING_LABEL = "Loading shell guidance…";
export const SHELL_GUIDANCE_UNAVAILABLE_LABEL = "Terminal setup guidance is unavailable.";

export function detectedShellLabel(detectedShell: string | null | undefined) {
  return detectedShell ? titleCase(detectedShell) : SHELL_CONFIG_UNAVAILABLE_LABEL;
}

export function shellHookStatusLabel(status: string | null | undefined) {
  if (status === "pass") {
    return "Installed";
  }
  if (status === "warn") {
    return "Not installed";
  }
  return SHELL_CONFIG_UNAVAILABLE_LABEL;
}

export function shellConfigPathLabel(
  variant: ShellHookGuidance["variants"][number] | undefined,
) {
  return variant?.config_path ?? SHELL_CONFIG_UNAVAILABLE_LABEL;
}

export function shellGuidanceFallbackLabel(isLoading: boolean) {
  return isLoading ? SHELL_GUIDANCE_LOADING_LABEL : SHELL_GUIDANCE_UNAVAILABLE_LABEL;
}
