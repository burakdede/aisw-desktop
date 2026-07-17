import type { DesktopRuntimeKind } from "./desktop-settings";
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

const RUNTIME_KIND_METADATA: Record<
  DesktopRuntimeKind,
  {
    selectionLabel: string;
    sourceLabel: string;
    summary: {
      source: string;
      description: string;
    };
  }
> = {
  bundled: {
    selectionLabel: INCLUDED_DESKTOP_ENGINE_LABEL,
    sourceLabel: INCLUDED_RUNTIME_SOURCE_LABEL,
    summary: {
      source: INCLUDED_WITH_APP_RUNTIME_SOURCE_LABEL,
      description: "AI Switch is already set to use the desktop engine bundled with this app.",
    },
  },
  system: {
    selectionLabel: SYSTEM_ENGINE_LABEL,
    sourceLabel: SYSTEM_OVERRIDE_LABEL,
    summary: {
      source: SYSTEM_OVERRIDE_LABEL,
      description:
        "AI Switch is currently pointing at a system-installed engine instead of the included one.",
    },
  },
  custom: {
    selectionLabel: CUSTOM_ENGINE_LABEL,
    sourceLabel: CUSTOM_OVERRIDE_LABEL,
    summary: {
      source: CUSTOM_OVERRIDE_LABEL,
      description:
        "AI Switch is currently pointing at a custom engine path instead of the included one.",
    },
  },
};

function runtimeKindMetadata(runtimeKind: DesktopRuntimeKind) {
  return RUNTIME_KIND_METADATA[runtimeKind];
}

export function runtimeSelectionLabel(runtimeKind: DesktopRuntimeKind) {
  return runtimeKindMetadata(runtimeKind).selectionLabel;
}

export function runtimeSourceLabel(runtimeKind: DesktopRuntimeKind) {
  return runtimeKindMetadata(runtimeKind).sourceLabel;
}

export function runtimeSummary(runtimeKind: DesktopRuntimeKind) {
  return runtimeKindMetadata(runtimeKind).summary;
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
