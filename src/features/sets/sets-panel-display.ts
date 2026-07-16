import type { WorkspaceBindInput, WorkspaceUnbindInput } from "../../lib/client";
import {
  CANCEL_LABEL,
  CLOSE_LABEL,
  inspectItemLabel,
  moreActionsLabel,
  noSelectionHeading,
  YES_LABEL,
} from "../../lib/display-copy";
import {
  DEFAULT_WORKSPACE_BINDING_SCOPE,
  normalizeWorkspaceBindingScope,
  type WorkspaceBindingScope,
} from "../../lib/workspace-binding-contract";
import { normalizeOneOf } from "../../lib/parse-guards";
import {
  contextDisplayLabel,
  missingProfileSetSelections,
  profileSetDisplayLabel,
  profileSetHasSelections,
  profileSetHasUsableSelections,
  profileSetIsActive,
  toolProfileDisplayLabel,
} from "../../lib/profile-display";
import type { AppSnapshot, DesktopSettings } from "../../lib/schemas";
import {
  importedContextActionLabel,
  importedContextStatus,
  profileSetStatus,
  setSelectionCountLabel,
} from "../../lib/sets-display";
import { CURRENT_LABEL } from "../../lib/status-copy";
import { toolShortName } from "../../lib/tool-registry";
import { buildKeyedRecord } from "../../lib/utils";

export type EditableProfileSet = {
  sourceName: string | null;
  name: string;
  label: string;
  profiles: Record<string, string>;
};

export const SETS_PANEL_MODES = ["sets", "rules"] as const;
export type SetPanelMode = (typeof SETS_PANEL_MODES)[number];
export const DEFAULT_SETS_PANEL_MODE: SetPanelMode = SETS_PANEL_MODES[0];

export type EditableRule = {
  source: WorkspaceUnbindInput | null;
  scope: WorkspaceBindingScope;
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

export type ImportedContextRowModel = {
  name: string;
  displayLabel: string;
  status: ReturnType<typeof importedContextStatus>;
  summary: string;
  actionLabel: string;
  active: boolean;
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

export type WorkspaceBindingTarget = WorkspaceBindInput["target"];

type EditorCopy = {
  dialogLabel: string;
  kicker?: string;
  title: string;
  submitLabel: string;
};

export const SETS_PANEL_COPY = {
  modeAriaLabel: "Sets mode",
  setLibraryModeLabel: "Set Library",
  projectRulesModeLabel: "Project Rules",
  newSetButtonLabel: "New Set…",
  setLibraryAriaLabel: "Set Library",
  importedContextsTitle: "Imported CLI contexts",
  importedContextsDetail:
    "Use an imported CLI context directly without turning it into a saved set.",
  importedContextSummaryPrefix: "CLI context · ",
  currentLabel: CURRENT_LABEL,
  editSetLabel: "Edit…",
  setActionsMenuAriaLabel: "Set actions",
  renameSetLabel: "Rename…",
  duplicateSetLabel: "Duplicate…",
  manageProjectRulesLabel: "Manage Project Rules…",
  removeSetLabel: "Remove…",
  noSavedSetSelectedTitle: noSelectionHeading("saved set"),
  noSavedSetSelectedDetail:
    "Select a saved set to inspect mapped profiles and switch it.",
  noSetsTitle: "No sets yet",
  noSetsPrimaryDetail:
    "Combine work, personal, or client profiles so you can switch multiple coding agents in one action.",
  createSetButtonLabel: "Create Set…",
  noSetsSecondaryDetail:
    "You can also switch individual profiles from Quick Switch.",
  projectMismatchTitle: "Project mismatch",
  expectedSetPrefix: "Expected set: ",
  currentSetPrefix: "Current set: ",
  keepCurrentSetLabel: "Keep current set",
  projectRulesAriaLabel: "Project Rules",
  projectRulesTitle: "Project Rules",
  projectRulesDetail:
    "Match folders, remotes, or a default fallback to a saved set.",
  addRuleButtonLabel: "Add Rule…",
  projectRulesActionsAriaLabel: "Project rules actions",
  openSetsLabel: "Open Sets",
  noProjectRulesTitle: "No project rules yet",
  noProjectRulesDetail:
    "Add a rule to match a default scope, folder, or git remote pattern to a saved set.",
  setUnavailableLabel: "Set Unavailable",
  enabledLabel: YES_LABEL,
  noRuleSelectedTitle: noSelectionHeading("rule"),
  noRuleSelectedDetail: "Select a rule to inspect it here.",
  closeLabel: CLOSE_LABEL,
  cancelLabel: CANCEL_LABEL,
  setNameLabel: "Set name",
  displayLabelFieldLabel: "Display label",
  notIncludedLabel: "Not included",
  projectRuleKicker: "Project rule",
  ruleScopeLabel: "Rule scope",
  defaultSetRuleScopeLabel: "Default set",
  pathPrefixRuleScopeLabel: "Path prefix",
  gitRemotePatternRuleScopeLabel: "Git remote pattern",
  pathLabel: "Path",
  gitRemotePatternLabel: "Git remote pattern",
  setFieldLabel: "Set",
  selectSetLabel: "Select set",
  summaryEmptyValue: "—",
} as const;

export const SETS_MODE_OPTIONS = SETS_PANEL_MODES.map((value) => ({
  value,
  label:
    value === "sets"
      ? SETS_PANEL_COPY.setLibraryModeLabel
      : SETS_PANEL_COPY.projectRulesModeLabel,
})) satisfies ReadonlyArray<{ value: SetPanelMode; label: string }>;

export const RULE_SCOPE_OPTIONS = [
  { value: "default", label: SETS_PANEL_COPY.defaultSetRuleScopeLabel },
  { value: "path", label: SETS_PANEL_COPY.pathPrefixRuleScopeLabel },
  { value: "git_remote", label: SETS_PANEL_COPY.gitRemotePatternRuleScopeLabel },
] as const;

export function normalizeSetPanelMode(
  value: unknown,
  fallback: SetPanelMode = DEFAULT_SETS_PANEL_MODE,
): SetPanelMode {
  return normalizeOneOf(SETS_PANEL_MODES, value, fallback);
}

const SET_EDITOR_COPY = {
  edit: {
    dialogLabel: "Edit Set",
    kicker: "Edit set",
    title: "Edit Set",
    submitLabel: "Save Set",
  },
  create: {
    dialogLabel: "New Set",
    kicker: "New set",
    title: "New Set",
    submitLabel: "Create Set",
  },
} as const satisfies Record<"edit" | "create", Required<EditorCopy>>;

const RULE_EDITOR_COPY = {
  edit: {
    dialogLabel: "Edit Rule",
    title: "Edit Project Rule",
    submitLabel: "Save Rule",
  },
  create: {
    dialogLabel: "Add Rule",
    title: "Add Project Rule",
    submitLabel: "Add Rule",
  },
} as const satisfies Record<"edit" | "create", EditorCopy>;

export function setActionsTriggerLabel(displayLabel: string) {
  return moreActionsLabel(displayLabel);
}

export function setRowAriaLabel(displayLabel: string) {
  return inspectItemLabel(`set ${displayLabel}`);
}

export function ruleRowAriaLabel(contextLabel: string) {
  return inspectItemLabel(`rule for ${contextLabel}`);
}

export function setEditorDialogLabel(isEditingSet: boolean) {
  return selectEditorCopy(SET_EDITOR_COPY, isEditingSet).dialogLabel;
}

export function setEditorKicker(isEditingSet: boolean) {
  return selectEditorCopy(SET_EDITOR_COPY, isEditingSet).kicker;
}

export function setEditorTitle(isEditingSet: boolean) {
  return selectEditorCopy(SET_EDITOR_COPY, isEditingSet).title;
}

export function setEditorSubmitLabel(isEditingSet: boolean) {
  return selectEditorCopy(SET_EDITOR_COPY, isEditingSet).submitLabel;
}

export function ruleEditorDialogLabel(isEditingRule: boolean) {
  return selectEditorCopy(RULE_EDITOR_COPY, isEditingRule).dialogLabel;
}

export function ruleEditorTitle(isEditingRule: boolean) {
  return selectEditorCopy(RULE_EDITOR_COPY, isEditingRule).title;
}

export function ruleEditorSubmitLabel(isEditingRule: boolean) {
  return selectEditorCopy(RULE_EDITOR_COPY, isEditingRule).submitLabel;
}

export function ruleTargetInputLabel(scope: WorkspaceBindingScope) {
  return scope === "path"
    ? SETS_PANEL_COPY.pathLabel
    : SETS_PANEL_COPY.gitRemotePatternLabel;
}

export function createEmptyEditableProfileSet(tools: readonly string[]): EditableProfileSet {
  return {
    sourceName: null,
    name: "",
    label: "",
    profiles: buildKeyedRecord(tools, () => ""),
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
    profiles: buildKeyedRecord(tools, (tool) => set.profiles[tool] ?? ""),
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
    profiles: buildKeyedRecord(tools, (tool) => existingSet.profiles[tool] ?? ""),
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
    scope: DEFAULT_WORKSPACE_BINDING_SCOPE,
    context: defaultContext,
    targetValue: "",
  };
}

export function createEditableRuleDraft(binding: {
  scope: string;
  target: string;
  context: string;
}): EditableRule {
  const scope = normalizeWorkspaceBindingScope(binding.scope);
  return {
    source: unbindTargetForBinding(binding.scope, binding.target),
    scope,
    context: binding.context,
    targetValue: scope === "default" ? "" : binding.target,
  };
}

export function unbindTargetForBinding(scope: string, target: string): WorkspaceUnbindInput {
  const normalizedScope = normalizeWorkspaceBindingScope(scope);
  if (normalizedScope === "path") {
    return { scope: "path", path: target };
  }
  if (normalizedScope === "git_remote") {
    return { scope: "git_remote", pattern: target };
  }
  return { scope: DEFAULT_WORKSPACE_BINDING_SCOPE };
}

export function buildWorkspaceBindingTarget(
  scope: WorkspaceBindingScope,
  targetValue: string,
): WorkspaceBindingTarget {
  if (scope === "default") {
    return { scope: "default" };
  }
  if (scope === "path") {
    return { scope: "path", path: targetValue };
  }
  return { scope: "git_remote", pattern: targetValue };
}

export function unbindTargetForWorkspaceBindingTarget(
  target: WorkspaceBindingTarget,
): WorkspaceUnbindInput {
  if (target.scope === "path") {
    return { scope: "path", path: target.path };
  }
  if (target.scope === "git_remote") {
    return { scope: "git_remote", pattern: target.pattern };
  }
  return { scope: "default" };
}

export function workspaceBindingTargetChanged(
  source: WorkspaceUnbindInput,
  target: WorkspaceBindingTarget,
) {
  const nextSource = unbindTargetForWorkspaceBindingTarget(target);

  if (source.scope !== nextSource.scope) {
    return true;
  }

  if (nextSource.scope === "path") {
    return source.path !== nextSource.path;
  }

  if (nextSource.scope === "git_remote") {
    return source.pattern !== nextSource.pattern;
  }

  return false;
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
      summary: buildToolSelectionSummary({
        profiles: set.profiles,
        settings: input.settings,
        snapshot: input.snapshot,
        tools: input.tools,
      }),
      missingSummary: missing.length
        ? missing.map(([tool, profile]) => `${tool}: ${profile}`).join(" · ")
        : null,
      usageCount: input.ruleUsageCountByContext.get(set.name) ?? 0,
    };
  });
}

export function buildImportedContextRows(input: {
  activeContext: string | null;
  importedContexts: AppSnapshot["contexts"];
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  tools: readonly string[];
}): ImportedContextRowModel[] {
  return input.importedContexts.map((entry) => {
    const active = input.activeContext === entry.name;
    const displayLabel = contextDisplayLabel(input.settings, entry.name);

    return {
      name: entry.name,
      displayLabel,
      status: importedContextStatus(active),
      summary: buildToolSelectionSummary({
        profiles: entry.profiles,
        settings: input.settings,
        snapshot: input.snapshot,
        tools: input.tools,
      }),
      actionLabel: importedContextActionLabel(active, displayLabel),
      active,
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
    mappedProfiles: input.tools.map((tool) => {
      const profile = input.selectedSet.profiles[tool];
      return {
        tool,
        value: profile
          ? toolProfileDisplayLabel(input.settings, input.snapshot, tool, profile)
          : "Not included",
      };
    }),
    projectRuleCount: input.ruleUsageCountByContext.get(input.selectedSet.name) ?? 0,
    warning,
  };
}

export function savedSetActivationLabel(displayLabel: string) {
  return `Activated saved set ${displayLabel}.`;
}

export function importedContextActivationResultLabel(displayLabel: string) {
  return `Activated set ${displayLabel}.`;
}

function buildToolSelectionSummary(input: {
  profiles: Record<string, string | null | undefined>;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  tools: readonly string[];
}) {
  return input.tools
    .map((tool) => formatToolSelectionSummaryItem(input, tool))
    .join(" · ");
}

function formatToolSelectionSummaryItem(
  input: {
    profiles: Record<string, string | null | undefined>;
    settings: DesktopSettings;
    snapshot: AppSnapshot;
  },
  tool: string,
) {
  const profile = input.profiles[tool];
  const label = profile
    ? toolProfileDisplayLabel(input.settings, input.snapshot, tool, profile)
    : SETS_PANEL_COPY.summaryEmptyValue;
  return `${toolShortName(tool)}: ${label}`;
}

function selectEditorCopy(
  copy: Record<"edit" | "create", EditorCopy>,
  isEditing: boolean,
) {
  return isEditing ? copy.edit : copy.create;
}
