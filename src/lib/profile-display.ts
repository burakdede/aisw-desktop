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
  const override = settings.profile_labels?.[tool]?.[profile];
  if (override) {
    return override;
  }

  const label = snapshot.profiles[tool]?.profiles.find((entry) => entry.name === profile)?.label;
  return label ?? titleCase(profile);
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
  const activeProfiles = snapshot.statuses
    .map((status) => status.active_profile?.trim())
    .filter((profile): profile is string => Boolean(profile));
  const uniqueProfiles = [...new Set(activeProfiles)].sort((left, right) => left.localeCompare(right));
  if (uniqueProfiles.length !== 1) {
    return null;
  }
  return profileDisplayLabel(settings, snapshot, uniqueProfiles[0]);
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
