import type { DesktopSettings } from "./schemas";
import {
  NEEDS_ATTENTION_LABEL,
  NEEDS_ATTENTION_SENTENCE_LABEL,
  READY_LABEL,
  SUPPORTED_LABEL,
} from "./status-copy";

export const INCLUDED_DESKTOP_ENGINE_LABEL = "Included desktop engine";
export const SYSTEM_ENGINE_LABEL = "System engine";
export const CUSTOM_ENGINE_LABEL = "Custom engine";
export const INCLUDED_RUNTIME_SOURCE_LABEL = "Included";
export const INCLUDED_WITH_APP_RUNTIME_SOURCE_LABEL = "Included with this app";
export const SYSTEM_OVERRIDE_LABEL = "System override";
export const CUSTOM_OVERRIDE_LABEL = "Custom override";

type RuntimeKind = DesktopSettings["runtime_kind"];

export function runtimeSelectionLabel(runtimeKind: RuntimeKind) {
  switch (runtimeKind) {
    case "bundled":
      return INCLUDED_DESKTOP_ENGINE_LABEL;
    case "system":
      return SYSTEM_ENGINE_LABEL;
    case "custom":
      return CUSTOM_ENGINE_LABEL;
  }
}

export function runtimeSourceLabel(runtimeKind: RuntimeKind) {
  switch (runtimeKind) {
    case "bundled":
      return INCLUDED_RUNTIME_SOURCE_LABEL;
    case "system":
      return SYSTEM_OVERRIDE_LABEL;
    case "custom":
      return CUSTOM_OVERRIDE_LABEL;
  }
}

export function runtimeSummary(runtimeKind: RuntimeKind) {
  switch (runtimeKind) {
    case "bundled":
      return {
        source: INCLUDED_WITH_APP_RUNTIME_SOURCE_LABEL,
        description: "AI Switch is already set to use the desktop engine bundled with this app.",
      };
    case "system":
      return {
        source: SYSTEM_OVERRIDE_LABEL,
        description:
          "AI Switch is currently pointing at a system-installed engine instead of the included one.",
      };
    case "custom":
      return {
        source: CUSTOM_OVERRIDE_LABEL,
        description:
          "AI Switch is currently pointing at a custom engine path instead of the included one.",
      };
  }
}

export function runtimeReadinessLabel(
  compatible: boolean,
  variant: "title" | "sentence" = "title",
) {
  if (compatible) {
    return READY_LABEL;
  }

  return variant === "sentence" ? NEEDS_ATTENTION_SENTENCE_LABEL : NEEDS_ATTENTION_LABEL;
}

export function runtimeCompatibilityLabel(compatible: boolean) {
  return compatible ? SUPPORTED_LABEL : NEEDS_ATTENTION_LABEL;
}
