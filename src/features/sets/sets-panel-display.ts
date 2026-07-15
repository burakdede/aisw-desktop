import type { WorkspaceUnbindInput } from "../../lib/client";
import { profileSetDisplayLabel } from "../../lib/profile-display";
import type { DesktopSettings } from "../../lib/schemas";

export type EditableProfileSet = {
  sourceName: string | null;
  name: string;
  label: string;
  profiles: Record<string, string>;
};

export type BindScope = "default" | "path" | "git_remote";

export type EditableRule = {
  source: WorkspaceUnbindInput | null;
  scope: BindScope;
  context: string;
  targetValue: string;
};

export function createEmptyEditableProfileSet(tools: readonly string[]): EditableProfileSet {
  return {
    sourceName: null,
    name: "",
    label: "",
    profiles: Object.fromEntries(tools.map((tool) => [tool, ""])),
  };
}

export function createEditableProfileSetDraft(
  set: NonNullable<DesktopSettings["profile_sets"]>[number],
  tools: readonly string[],
): EditableProfileSet {
  return {
    sourceName: set.name,
    name: set.name,
    label: set.label ?? "",
    profiles: Object.fromEntries(tools.map((tool) => [tool, set.profiles[tool] ?? ""])),
  };
}

export function duplicateEditableProfileSetDraft(
  existingSet: NonNullable<DesktopSettings["profile_sets"]>[number],
  localSets: NonNullable<DesktopSettings["profile_sets"]>,
  tools: readonly string[],
): EditableProfileSet {
  const baseName = `${existingSet.name}-copy`;
  let nextName = baseName;
  let suffix = 2;
  while (localSets.some((entry) => entry.name === nextName)) {
    nextName = `${baseName}-${suffix}`;
    suffix += 1;
  }

  return {
    sourceName: null,
    name: nextName,
    label: existingSet.label
      ? `${existingSet.label} Copy`
      : `${profileSetDisplayLabel(existingSet)} Copy`,
    profiles: Object.fromEntries(tools.map((tool) => [tool, existingSet.profiles[tool] ?? ""])),
  };
}

export function createEmptyRuleDraft(defaultContext = ""): EditableRule {
  return {
    source: null,
    scope: "default",
    context: defaultContext,
    targetValue: "",
  };
}

export function createEditableRuleDraft(binding: {
  scope: string;
  target: string;
  context: string;
}): EditableRule {
  return {
    source: unbindTargetForBinding(binding.scope, binding.target),
    scope:
      binding.scope === "path" || binding.scope === "git_remote"
        ? binding.scope
        : "default",
    context: binding.context,
    targetValue: binding.scope === "default" ? "" : binding.target,
  };
}

export function unbindTargetForBinding(scope: string, target: string): WorkspaceUnbindInput {
  if (scope === "path") {
    return { scope: "path", path: target };
  }
  if (scope === "git_remote") {
    return { scope: "git_remote", pattern: target };
  }
  return { scope: "default" };
}
