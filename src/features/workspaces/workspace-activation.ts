import { AppSnapshot, DesktopSettings } from "../../lib/schemas";
import { profileSetHasUsableSelections } from "../../lib/profile-display";
import {
  resolveGlobalStateMode,
  type StateModeRequest,
} from "../shared/state-modes";

export type WorkspaceActivationTarget =
  | { kind: "profile_set"; name: string; label: string }
  | { kind: "context"; name: string; stateMode: StateModeRequest };

export type WorkspaceBindingOptionKind = "saved_set" | "available_set";

export type WorkspaceBindingOption = {
  value: string;
  label: string;
  kind: WorkspaceBindingOptionKind;
  displayLabel: string;
};

export const WORKSPACE_BINDING_OPTION_COPY = {
  savedSetPrefix: "Saved set: ",
  availableSetPrefix: "Available set: ",
} as const;

export function resolveWorkspaceActivationTarget(
  expectedContext: string,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): WorkspaceActivationTarget | null {
  const profileSet = settings.profile_sets?.find(
    (set) => set.name === expectedContext && profileSetHasUsableSelections(snapshot, set),
  );
  if (profileSet) {
    return { kind: "profile_set", name: expectedContext, label: profileSet.label ?? profileSet.name };
  }
  if (snapshot.contexts.some((context) => context.name === expectedContext)) {
    return {
      kind: "context",
      name: expectedContext,
      stateMode: resolveGlobalStateMode(snapshot),
    };
  }
  return null;
}

export function workspaceBindingOptions(
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): WorkspaceBindingOption[] {
  const profileSets = (settings.profile_sets ?? [])
    .filter((set) => profileSetHasUsableSelections(snapshot, set))
    .map((set) =>
      buildWorkspaceBindingOption("saved_set", set.name, set.label ?? set.name),
    );
  const contexts = snapshot.contexts
    .filter((context) => !profileSets.some((set) => set.value === context.name))
    .map((context) =>
      buildWorkspaceBindingOption("available_set", context.name, context.name),
    );

  return [...profileSets, ...contexts].sort((left, right) => left.value.localeCompare(right.value));
}

export function workspaceBindingOptionSavedSetLabel(
  option: Pick<WorkspaceBindingOption, "kind" | "displayLabel"> | undefined,
) {
  return option?.kind === "saved_set" ? option.displayLabel : undefined;
}

function buildWorkspaceBindingOption(
  kind: WorkspaceBindingOptionKind,
  value: string,
  displayLabel: string,
): WorkspaceBindingOption {
  return {
    value,
    displayLabel,
    kind,
    label: formatWorkspaceBindingOptionLabel(kind, displayLabel),
  };
}

function formatWorkspaceBindingOptionLabel(
  kind: WorkspaceBindingOptionKind,
  displayLabel: string,
) {
  return `${workspaceBindingOptionPrefix(kind)}${displayLabel}`;
}

function workspaceBindingOptionPrefix(kind: WorkspaceBindingOptionKind) {
  return kind === "saved_set"
    ? WORKSPACE_BINDING_OPTION_COPY.savedSetPrefix
    : WORKSPACE_BINDING_OPTION_COPY.availableSetPrefix;
}
