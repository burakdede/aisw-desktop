import { isOneOf } from "./parse-guards";

export const APP_NAV_IDS = {
  overview: "overview",
  profiles: "profiles",
  sets: "sets",
  diagnostics: "diagnostics",
  backups: "backups",
  activity: "activity",
  settings: "settings",
} as const;

export type AppNavId = (typeof APP_NAV_IDS)[keyof typeof APP_NAV_IDS];

const APP_NAV_ID_VALUES = Object.values(APP_NAV_IDS);

export const APP_NAV_GROUPS = {
  main: "Main",
  health: "Health",
  app: "App",
} as const;

export type AppNavGroup = (typeof APP_NAV_GROUPS)[keyof typeof APP_NAV_GROUPS];
export type DefaultAppSection = Exclude<AppNavId, typeof APP_NAV_IDS.settings>;

export type AppNavItem = {
  id: AppNavId;
  label: string;
  group: AppNavGroup;
  defaultSection: boolean;
  shortcut?: string;
};

type AppNavDefinition = Omit<AppNavItem, "shortcut"> & {
  shortcutKey?: string;
};

const APP_NAV_DEFINITIONS = [
  {
    id: APP_NAV_IDS.overview,
    label: "Overview",
    group: APP_NAV_GROUPS.main,
    defaultSection: true,
    shortcutKey: "1",
  },
  {
    id: APP_NAV_IDS.profiles,
    label: "Profiles",
    group: APP_NAV_GROUPS.main,
    defaultSection: true,
    shortcutKey: "2",
  },
  {
    id: APP_NAV_IDS.sets,
    label: "Sets",
    group: APP_NAV_GROUPS.main,
    defaultSection: true,
    shortcutKey: "3",
  },
  {
    id: APP_NAV_IDS.diagnostics,
    label: "Diagnostics",
    group: APP_NAV_GROUPS.health,
    defaultSection: true,
    shortcutKey: "4",
  },
  {
    id: APP_NAV_IDS.backups,
    label: "Backups",
    group: APP_NAV_GROUPS.health,
    defaultSection: true,
    shortcutKey: "5",
  },
  {
    id: APP_NAV_IDS.activity,
    label: "Activity",
    group: APP_NAV_GROUPS.health,
    defaultSection: true,
    shortcutKey: "6",
  },
  {
    id: APP_NAV_IDS.settings,
    label: "Settings",
    group: APP_NAV_GROUPS.app,
    defaultSection: false,
    shortcutKey: ",",
  },
] as const satisfies readonly AppNavDefinition[];

function appNavShortcutLabel(key: string) {
  return `⌘${key}`;
}

export const APP_NAV_LABELS: Record<AppNavId, string> = Object.fromEntries(
  APP_NAV_DEFINITIONS.map((item) => [item.id, item.label]),
) as Record<AppNavId, string>;

export const APP_NAV_SHORTCUT_KEYS: Record<string, DefaultAppSection> = Object.fromEntries(
  APP_NAV_DEFINITIONS.filter(
    (item): item is (typeof APP_NAV_DEFINITIONS)[number] & { id: DefaultAppSection; shortcutKey: string } =>
      item.defaultSection && typeof item.shortcutKey === "string",
  ).map((item) => [item.shortcutKey, item.id]),
) as Record<string, DefaultAppSection>;

export const APP_NAV_SHORTCUT_LABELS: Partial<Record<AppNavId, string>> = Object.fromEntries(
  APP_NAV_DEFINITIONS.filter(
    (item): item is (typeof APP_NAV_DEFINITIONS)[number] & { shortcutKey: string } =>
      typeof item.shortcutKey === "string",
  ).map((item) => [item.id, appNavShortcutLabel(item.shortcutKey)]),
) as Partial<Record<AppNavId, string>>;

export const APP_NAV_ITEMS: readonly AppNavItem[] = APP_NAV_DEFINITIONS.map((item) => ({
  id: item.id,
  label: item.label,
  group: item.group,
  defaultSection: item.defaultSection,
  shortcut:
    typeof item.shortcutKey === "string" ? appNavShortcutLabel(item.shortcutKey) : undefined,
}));

export const DEFAULT_APP_SECTIONS = APP_NAV_ITEMS.filter(
  (item): item is AppNavItem & { id: DefaultAppSection } => item.defaultSection,
).map((item) => item.id) as readonly DefaultAppSection[];

export function isAppNavId(value: string): value is AppNavId {
  return isOneOf(APP_NAV_ID_VALUES, value);
}
