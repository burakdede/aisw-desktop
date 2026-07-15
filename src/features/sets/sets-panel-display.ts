import type { WorkspaceUnbindInput } from "../../lib/client";
import {
  missingProfileSetSelections,
  profileSetDisplayLabel,
  profileSetHasSelections,
  profileSetHasUsableSelections,
  profileSetIsActive,
  toolProfileDisplayLabel,
} from "../../lib/profile-display";
import type { AppSnapshot, DesktopSettings } from "../../lib/schemas";
import { profileSetStatus, setSelectionCountLabel } from "../../lib/sets-display";
import { toolShortName } from "../../lib/tool-registry";

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

export type SavedSetRowModel = {
  name: string;
  displayLabel: string;
  selected: boolean;
  active: boolean;
  status: ReturnType<typeof profileSetStatus>;
  summary: string;
  missingSummary: string | null;
  usageCount: number;
};

export type SelectedSetInspectorState = {
  displayLabel: string;
  isCurrent: boolean;
  canActivate: boolean;
  activateLabel: string;
  selectionCountLabel: string;
  mappedProfiles: Array<{ tool: string; value: string }>;
  projectRuleCount: number;
  warning: string | null;
};

export type SetSettingsUpdate = Pick<
  DesktopSettings,
  | "runtime_kind"
  | "runtime_path"
  | "aisw_home"
  | "update_channel"
  | "profile_labels"
  | "profile_sets"
>;

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

export function hasDuplicateSetName(
  localSets: NonNullable<DesktopSettings["profile_sets"]>,
  draftName: string,
  sourceName: string | null,
) {
  return (
    draftName.length > 0 &&
    localSets.some((entry) => entry.name === draftName && entry.name !== sourceName)
  );
}

export function buildSetSettingsUpdate(
  settings: DesktopSettings,
  profileSets: NonNullable<DesktopSettings["profile_sets"]>,
): SetSettingsUpdate {
  return {
    runtime_kind: settings.runtime_kind,
    runtime_path: settings.runtime_path ?? null,
    aisw_home: settings.aisw_home ?? null,
    update_channel: settings.update_channel,
    profile_labels: settings.profile_labels ?? {},
    profile_sets: profileSets,
  };
}

export function buildSavedSetCollection(
  localSets: NonNullable<DesktopSettings["profile_sets"]>,
  draft: EditableProfileSet,
  draftName: string,
) {
  return [
    ...localSets.filter((entry) => entry.name !== (draft.sourceName ?? draftName)),
    {
      name: draftName,
      label: draft.label.trim() || null,
      profiles: Object.fromEntries(
        Object.entries(draft.profiles).map(([tool, profile]) => [tool, profile || null]),
      ),
    },
  ].sort((left, right) => left.name.localeCompare(right.name));
}

export function savedSetActionLabel(
  draftName: string,
  draftLabel: string,
  isEditingSet: boolean,
) {
  const displayLabel = draftLabel.trim() || draftName;
  return `${isEditingSet ? "Updated" : "Saved"} set ${displayLabel}.`;
}

export function deletedSetActionLabel(
  localSets: NonNullable<DesktopSettings["profile_sets"]>,
  name: string,
) {
  const displayLabel = profileSetDisplayLabel(
    localSets.find((entry) => entry.name === name) ?? { name, label: null, profiles: {} },
  );
  return `Deleted set ${displayLabel}.`;
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

export function countRuleUsageByContext(
  bindings: Array<{ context: string }>,
) {
  const usageByContext = new Map<string, number>();
  for (const entry of bindings) {
    usageByContext.set(entry.context, (usageByContext.get(entry.context) ?? 0) + 1);
  }
  return usageByContext;
}

export function buildSavedSetRows(input: {
  localSets: NonNullable<DesktopSettings["profile_sets"]>;
  ruleUsageCountByContext: Map<string, number>;
  selectedSetName: string | null;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  tools: readonly string[];
}) {
  return input.localSets.map((set) => {
    const selected = input.selectedSetName === set.name;
    const active = profileSetIsActive(input.snapshot, set);
    const ready = profileSetHasUsableSelections(input.snapshot, set);
    const missing = missingProfileSetSelections(input.snapshot, set);

    return {
      name: set.name,
      displayLabel: profileSetDisplayLabel(set),
      selected,
      active,
      status: profileSetStatus(active, ready),
      summary: input.tools
        .map((tool) => {
          const profile = set.profiles[tool];
          const label = profile
            ? toolProfileDisplayLabel(input.settings, input.snapshot, tool, profile)
            : "—";
          return `${toolShortName(tool)}: ${label}`;
        })
        .join(" · "),
      missingSummary: missing.length
        ? missing.map(([tool, profile]) => `${tool}: ${profile}`).join(" · ")
        : null,
      usageCount: input.ruleUsageCountByContext.get(set.name) ?? 0,
    };
  });
}

export function buildSelectedSetInspectorState(input: {
  selectedSet: NonNullable<DesktopSettings["profile_sets"]>[number];
  ruleUsageCountByContext: Map<string, number>;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  tools: readonly string[];
}): SelectedSetInspectorState {
  const selectedCount = Object.values(input.selectedSet.profiles).filter(
    (profile) => typeof profile === "string" && profile.trim().length > 0,
  ).length;
  const missing = missingProfileSetSelections(input.snapshot, input.selectedSet);
  const isCurrent = profileSetIsActive(input.snapshot, input.selectedSet);
  const canActivate =
    !isCurrent && profileSetHasUsableSelections(input.snapshot, input.selectedSet);

  let warning: string | null = null;
  if (!profileSetHasSelections(input.selectedSet)) {
    warning = "This saved set is empty and cannot be activated yet.";
  } else if (missing.length) {
    warning = `Missing mapped profiles: ${missing
      .map(([tool, profile]) => `${tool}: ${profile}`)
      .join(" · ")}`;
  }

  return {
    displayLabel: profileSetDisplayLabel(input.selectedSet),
    isCurrent,
    canActivate,
    activateLabel: isCurrent
      ? "Current"
      : `Switch to ${profileSetDisplayLabel(input.selectedSet)}`,
    selectionCountLabel: setSelectionCountLabel(selectedCount),
    mappedProfiles: input.tools.map((tool) => ({
      tool,
      value: input.selectedSet.profiles[tool]
        ? toolProfileDisplayLabel(
            input.settings,
            input.snapshot,
            tool,
            input.selectedSet.profiles[tool] as string,
          )
        : "Not included",
    })),
    projectRuleCount: input.ruleUsageCountByContext.get(input.selectedSet.name) ?? 0,
    warning,
  };
}
