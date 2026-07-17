import type { AppSnapshot, DesktopSettings } from "./schemas";
import { findMatchingItem, titleCase } from "./utils";

export function snapshotHasToolProfile(
  snapshot: AppSnapshot,
  tool: string,
  profile: string,
) {
  return (
    snapshot.profiles[tool]?.profiles.some((candidate) => candidate.name === profile) ?? false
  );
}

export function snapshotHasContext(snapshot: AppSnapshot, context: string) {
  return snapshot.contexts.some((entry) => entry.name === context);
}

export function findSnapshotToolStatus(snapshot: AppSnapshot, tool: string) {
  return findMatchingItem(tool, snapshot.statuses, (entry) => entry.tool);
}

export function findSnapshotToolProfileEntry(
  snapshot: AppSnapshot,
  tool: string,
  profile: string,
) {
  return findMatchingItem(profile, snapshot.profiles[tool]?.profiles ?? [], (entry) => entry.name);
}

export function findProfileSetByName(
  profileSets: NonNullable<DesktopSettings["profile_sets"]>,
  name: string | null | undefined,
) {
  return findMatchingItem(name, profileSets, (entry) => entry.name);
}

export function profileDisplayLabel(
  settings: DesktopSettings,
  snapshot: AppSnapshot,
  profile: string,
): string {
  const override = findProfileOverride(settings, profile);
  if (override) {
    return override;
  }

  const toolNames = Object.keys(snapshot.profiles).sort((left, right) => left.localeCompare(right));
  for (const tool of toolNames) {
    const label = findSnapshotToolProfileEntry(snapshot, tool, profile)?.label;
    if (label) {
      return label;
    }
  }

  return titleCase(profile);
}

export function toolProfileDisplayLabel(
  settings: DesktopSettings,
  snapshot: AppSnapshot,
  tool: string,
  profile: string,
): string {
  const label = findSnapshotToolProfileEntry(snapshot, tool, profile)?.label;
  return effectiveToolProfileLabel(settings, tool, profile, label);
}

export function effectiveToolProfileLabel(
  settings: DesktopSettings,
  tool: string,
  profile: string,
  currentLabel: string | null | undefined,
): string {
  const override = toolProfileLabelOverride(settings, tool, profile);
  if (override) {
    return override;
  }
  return currentLabel ?? titleCase(profile);
}

export function hasCustomProfileLabel(
  profile: string | null | undefined,
  label: string | null | undefined,
) {
  return Boolean(profile && label && label !== titleCase(profile));
}

export function mergeProfileLabel(
  settings: DesktopSettings,
  tool: string,
  profile: string,
  label: string | null,
) {
  const currentToolLabels = profileLabelOverridesForTool(settings, tool);
  const next = {
    ...(settings.profile_labels ?? {}),
    [tool]: {
      ...currentToolLabels,
      [profile]: label,
    },
  };

  if (label === null && Object.values(next[tool]).every((value) => value == null)) {
    delete next[tool];
  }

  return next;
}

export function sharedProfileEntries(settings: DesktopSettings, snapshot: AppSnapshot) {
  const counts = new Map<string, number>();
  Object.values(snapshot.profiles).forEach((entry) => {
    entry.profiles.forEach((profile) => {
      counts.set(profile.name, (counts.get(profile.name) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => ({
      name,
      label: profileDisplayLabel(settings, snapshot, name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function activeSetLabel(settings: DesktopSettings, snapshot: AppSnapshot) {
  const activeProfileSet = [...(settings.profile_sets ?? [])]
    .sort((left, right) => left.name.localeCompare(right.name))
    .find((set) => profileSetIsActive(snapshot, set));
  if (activeProfileSet) {
    return profileSetDisplayLabel(activeProfileSet);
  }

  const activeProfiles = snapshot.statuses
    .map((status) => status.active_profile?.trim())
    .filter((profile): profile is string => Boolean(profile));
  const uniqueProfiles = [...new Set(activeProfiles)].sort((left, right) => left.localeCompare(right));
  if (uniqueProfiles.length !== 1) {
    return null;
  }
  return profileDisplayLabel(settings, snapshot, uniqueProfiles[0]);
}

export function profileSetDisplayLabel(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
  return set.label ?? set.name;
}

export function profileSetHasSelections(
  set: NonNullable<DesktopSettings["profile_sets"]>[number],
) {
  return Object.values(set.profiles).some(
    (profile) => typeof profile === "string" && profile.trim().length > 0,
  );
}

export function missingProfileSetSelections(
  snapshot: AppSnapshot,
  set: NonNullable<DesktopSettings["profile_sets"]>[number],
) {
  return Object.entries(set.profiles)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
    .filter(([tool, profile]) => !snapshotHasToolProfile(snapshot, tool, profile));
}

export function profileSetHasUsableSelections(
  snapshot: AppSnapshot,
  set: NonNullable<DesktopSettings["profile_sets"]>[number],
) {
  return profileSetHasSelections(set) && missingProfileSetSelections(snapshot, set).length === 0;
}

export function contextDisplayLabel(settings: DesktopSettings, context: string) {
  const profileSet = findProfileSetByName(settings.profile_sets ?? [], context);
  return profileSet ? profileSetDisplayLabel(profileSet) : context;
}

export function profileSetIsActive(
  snapshot: AppSnapshot,
  set: NonNullable<DesktopSettings["profile_sets"]>[number],
) {
  const selectedProfiles = Object.entries(set.profiles).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );
  return (
    profileSetHasSelections(set) &&
    selectedProfiles.every(
      ([tool, profile]) =>
        findSnapshotToolStatus(snapshot, tool)?.active_profile === profile,
    )
  );
}

function findProfileOverride(settings: DesktopSettings, profile: string) {
  const toolNames = Object.keys(settings.profile_labels ?? {}).sort((left, right) =>
    left.localeCompare(right),
  );
  for (const tool of toolNames) {
    const label = toolProfileLabelOverride(settings, tool, profile);
    if (label) {
      return label;
    }
  }
  return null;
}

function profileLabelOverridesForTool(settings: DesktopSettings, tool: string) {
  return settings.profile_labels?.[tool] ?? {};
}

function toolProfileLabelOverride(
  settings: DesktopSettings,
  tool: string,
  profile: string,
) {
  return profileLabelOverridesForTool(settings, tool)[profile];
}
