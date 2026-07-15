import type { DesktopSettings } from "./schemas";

export const INCLUDED_DESKTOP_ENGINE_LABEL = "Included desktop engine";

type RuntimeKind = DesktopSettings["runtime_kind"];

export function runtimeSelectionLabel(runtimeKind: RuntimeKind) {
  switch (runtimeKind) {
    case "bundled":
      return INCLUDED_DESKTOP_ENGINE_LABEL;
    case "system":
      return "System engine";
    case "custom":
      return "Custom engine";
  }
}

export function runtimeSourceLabel(runtimeKind: RuntimeKind) {
  switch (runtimeKind) {
    case "bundled":
      return "Included";
    case "system":
      return "System override";
    case "custom":
      return "Custom override";
  }
}

export function runtimeSummary(runtimeKind: RuntimeKind) {
  switch (runtimeKind) {
    case "bundled":
      return {
        source: "Included with this app",
        description: "AI Switch is already set to use the desktop engine bundled with this app.",
      };
    case "system":
      return {
        source: "System override",
        description:
          "AI Switch is currently pointing at a system-installed engine instead of the included one.",
      };
    case "custom":
      return {
        source: "Custom override",
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
    return "Ready";
  }

  return variant === "sentence" ? "Needs attention" : "Needs Attention";
}

export function runtimeCompatibilityLabel(compatible: boolean) {
  return compatible ? "Supported" : "Needs Attention";
}
