import { AppSnapshot, DesktopSettings } from "../../lib/schemas";

export type WorkspaceActivationTarget =
  | { kind: "profile_set"; name: string; label: string }
  | { kind: "context"; name: string };

export function resolveWorkspaceActivationTarget(
  expectedContext: string,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): WorkspaceActivationTarget {
  const profileSet = settings.profile_sets?.find((set) => set.name === expectedContext);
  if (profileSet) {
    return { kind: "profile_set", name: expectedContext, label: profileSet.label ?? profileSet.name };
  }
  if (snapshot.contexts.some((context) => context.name === expectedContext)) {
    return { kind: "context", name: expectedContext };
  }
  return { kind: "context", name: expectedContext };
}

export function workspaceBindingOptions(
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): Array<{ value: string; label: string }> {
  const profileSets = (settings.profile_sets ?? []).map((set) => ({
    value: set.name,
    label: `Profile set: ${set.label ?? set.name}`,
  }));
  const contexts = snapshot.contexts
    .filter((context) => !profileSets.some((set) => set.value === context.name))
    .map((context) => ({
      value: context.name,
      label: `CLI context: ${context.name}`,
    }));

  return [...profileSets, ...contexts].sort((left, right) => left.value.localeCompare(right.value));
}
