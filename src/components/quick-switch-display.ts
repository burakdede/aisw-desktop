import type { AppSnapshot, DesktopSettings } from "../lib/schemas";
import {
  profileSetDisplayLabel,
  profileSetHasUsableSelections,
  sharedProfileEntries,
  toolProfileDisplayLabel,
} from "../lib/profile-display";
import { toolDisplayName } from "../lib/tool-display";
import { countLabel } from "../lib/utils";

export type QuickSwitchItem =
  | {
      id: string;
      kind: "profile_set";
      group: "Sets";
      title: string;
      subtitle: string;
      searchText: string;
      active: boolean;
      name: string;
      label?: string;
    }
  | {
      id: string;
      kind: "shared_profile";
      group: "Matching profiles";
      title: string;
      subtitle: string;
      searchText: string;
      active: boolean;
      profile: string;
      label: string;
    }
  | {
      id: string;
      kind: "tool_profile";
      group: string;
      title: string;
      subtitle: string;
      searchText: string;
      active: boolean;
      tool: string;
      profile: string;
      label: string;
    };

export function buildQuickSwitchItems(settings: DesktopSettings, snapshot: AppSnapshot): QuickSwitchItem[] {
  const items: QuickSwitchItem[] = [];

  for (const set of [...(settings.profile_sets ?? [])].sort((left, right) => left.name.localeCompare(right.name))) {
    if (!profileSetHasUsableSelections(snapshot, set)) {
      continue;
    }
    const subtitle = quickSwitchSetSubtitle(set);
    const active = Object.entries(set.profiles)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .every(([tool, profile]) => snapshot.profiles[tool]?.active === profile);
    items.push({
      id: `set:${set.name}`,
      kind: "profile_set",
      group: "Sets",
      title: profileSetDisplayLabel(set),
      subtitle,
      searchText: `${set.name} ${set.label ?? ""} ${subtitle}`.toLowerCase(),
      active,
      name: set.name,
      label: set.label ?? undefined,
    });
  }

  for (const profile of sharedProfileEntries(settings, snapshot)) {
    const matchingTools = sharedProfileToolLabels(snapshot, profile.name);
    const active = snapshot.statuses
      .filter((status) => status.active_profile)
      .every((status) => status.active_profile === profile.name);
    items.push({
      id: `shared:${profile.name}`,
      kind: "shared_profile",
      group: "Matching profiles",
      title: profile.label,
      subtitle: `Across ${matchingTools.join(", ")}`,
      searchText: `${profile.name} ${profile.label} ${matchingTools.join(" ")}`.toLowerCase(),
      active,
      profile: profile.name,
      label: profile.label,
    });
  }

  for (const tool of Object.keys(snapshot.profiles).sort((left, right) => left.localeCompare(right))) {
    const profiles = snapshot.profiles[tool]?.profiles ?? [];
    for (const profile of profiles) {
      const label = toolProfileDisplayLabel(settings, snapshot, tool, profile.name);
      const toolLabel = toolDisplayName(tool);
      items.push({
        id: `tool:${tool}:${profile.name}`,
        kind: "tool_profile",
        group: toolLabel,
        title: label,
        subtitle: `${toolLabel} · ${profile.name} · ${profile.auth}`,
        searchText: `${tool} ${profile.name} ${profile.auth} ${label}`.toLowerCase(),
        active: snapshot.profiles[tool]?.active === profile.name,
        tool,
        profile: profile.name,
        label,
      });
    }
  }

  return items;
}

export function quickSwitchShortcutSummary(item: QuickSwitchItem | null) {
  return item?.kind === "profile_set" ? "Enter switches set" : "⌘Enter matches tools";
}

export function quickSwitchStatusCopy(item: QuickSwitchItem | null) {
  if (!item) {
    return {
      label: "Selection",
      title: "No matches",
      subtitle: quickSwitchNoMatchesDescription(),
      shortcut: null,
    };
  }

  return {
    label: item.group,
    title: item.title,
    subtitle: item.active ? "Current selection" : item.subtitle,
    shortcut: quickSwitchShortcutSummary(item),
  };
}

export function quickSwitchResultCountLabel(count: number) {
  return countLabel(count, "result");
}

export function quickSwitchNoMatchesDescription() {
  return "Search by set name, tool, profile name, or saved label.";
}

function quickSwitchSetSubtitle(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
  return Object.entries(set.profiles)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
    .map(([tool, profile]) => `${toolDisplayName(tool)}: ${profile}`)
    .join("  ");
}

function sharedProfileToolLabels(snapshot: AppSnapshot, profileName: string) {
  return Object.keys(snapshot.profiles)
    .filter((tool) =>
      snapshot.profiles[tool]?.profiles.some((profile) => profile.name === profileName),
    )
    .map((tool) => toolDisplayName(tool));
}
