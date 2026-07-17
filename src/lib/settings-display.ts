import type { ShellHookGuidance } from "./schemas";
import { normalizeCheckStatus } from "./check-status";
import { nullishToEmptyString, nullishToUndefined } from "./parse-guards";
import { NOT_INSTALLED_LABEL, UNAVAILABLE_LABEL } from "./status-copy";
import {
  resolvePreferredSelectionValueOrEmpty,
  resolveSelectionItem,
  titleCase,
} from "./utils";

export const SHELL_CONFIG_UNAVAILABLE_LABEL = UNAVAILABLE_LABEL;
export const SHELL_COMPLETION_AVAILABLE_LABEL = "Available in this build";
export const SHELL_GUIDANCE_LOADING_LABEL = "Loading shell guidance…";
export const SHELL_GUIDANCE_UNAVAILABLE_LABEL = "Terminal setup guidance is unavailable.";
export const SHELL_HOOK_INSTALLED_LABEL = "Installed";
export const SHELL_HOOK_NOT_INSTALLED_LABEL = NOT_INSTALLED_LABEL;

type ShellGuidanceVariantLike = Pick<ShellHookGuidance["variants"][number], "shell" | "config_path">;
type ShellGuidanceLike<Variant extends ShellGuidanceVariantLike = ShellGuidanceVariantLike> = {
  detected_shell?: string | null;
  variants?: readonly Variant[] | null;
};

function shellGuidanceVariants<Variant extends ShellGuidanceVariantLike>(
  shellGuidance: ShellGuidanceLike<Variant> | undefined,
) {
  const variants = shellGuidance?.variants;
  return Array.isArray(variants) && variants.length ? variants : undefined;
}

export function detectedShellLabel(detectedShell: string | null | undefined) {
  return detectedShell ? titleCase(detectedShell) : SHELL_CONFIG_UNAVAILABLE_LABEL;
}

export function shellHookStatusLabel(status: string | null | undefined) {
  const normalizedStatus = normalizeCheckStatus(status, "warn");
  if (normalizedStatus === "pass") {
    return SHELL_HOOK_INSTALLED_LABEL;
  }
  if (normalizedStatus === "warn") {
    return SHELL_HOOK_NOT_INSTALLED_LABEL;
  }
  return SHELL_CONFIG_UNAVAILABLE_LABEL;
}

export function shellConfigPathLabel<Variant extends { config_path: string }>(
  variant: Variant | undefined,
) {
  return variant?.config_path ?? SHELL_CONFIG_UNAVAILABLE_LABEL;
}

export function selectedShellVariant<Variant extends ShellGuidanceVariantLike>(
  shellGuidance: ShellGuidanceLike<Variant> | undefined,
  selectedShell: string,
) {
  const variants = shellGuidanceVariants(shellGuidance);
  if (!variants) {
    return undefined;
  }

  return nullishToUndefined(resolveSelectionItem(selectedShell, variants, (variant) => variant.shell));
}

export function selectedShellValue(
  shellGuidance: ShellGuidanceLike | undefined,
  currentShell: string,
) {
  const variants = shellGuidanceVariants(shellGuidance);
  if (!variants) {
    return "";
  }

  return resolvePreferredSelectionValueOrEmpty(
    currentShell,
    nullishToEmptyString(shellGuidance?.detected_shell),
    variants,
    (variant) => variant.shell,
  );
}

export function shellGuidanceFallbackLabel(isLoading: boolean) {
  return isLoading ? SHELL_GUIDANCE_LOADING_LABEL : SHELL_GUIDANCE_UNAVAILABLE_LABEL;
}
