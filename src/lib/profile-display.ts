import type { AppSnapshot, DesktopSettings } from "./schemas";
import { titleCase } from "./utils";

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
    const label = snapshot.profiles[tool]?.profiles.find((entry) => entry.name === profile)?.label;
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
  const label = snapshot.profiles[tool]?.profiles.find((entry) => entry.name === profile)?.label;
  return effectiveToolProfileLabel(settings, tool, profile, label);
}

export function effectiveToolProfileLabel(
  settings: DesktopSettings,
  tool: string,
  profile: string,
  currentLabel: string | null | undefined,
): string {
  const override = settings.profile_labels?.[tool]?.[profile];
  if (override) {
    return override;
  }
  return currentLabel ?? titleCase(profile);
}

export function mergeProfileLabel(
  settings: DesktopSettings,
  tool: string,
  profile: string,
  label: string | null,
) {
  const next = {
    ...(settings.profile_labels ?? {}),
    [tool]: {
      ...(settings.profile_labels?.[tool] ?? {}),
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
    .filter(([tool, profile]) =>
      !snapshot.profiles[tool]?.profiles.some((candidate) => candidate.name === profile),
    );
}

export function profileSetHasUsableSelections(
  snapshot: AppSnapshot,
  set: NonNullable<DesktopSettings["profile_sets"]>[number],
) {
  return profileSetHasSelections(set) && missingProfileSetSelections(snapshot, set).length === 0;
}

export function contextDisplayLabel(settings: DesktopSettings, context: string) {
  const profileSet = (settings.profile_sets ?? []).find((entry) => entry.name === context);
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
        snapshot.statuses.find((status) => status.tool === tool)?.active_profile === profile,
    )
  );
}

function findProfileOverride(settings: DesktopSettings, profile: string) {
  const toolNames = Object.keys(settings.profile_labels ?? {}).sort((left, right) =>
    left.localeCompare(right),
  );
  for (const tool of toolNames) {
    const label = settings.profile_labels?.[tool]?.[profile];
    if (label) {
      return label;
    }
  }
  return null;
}
