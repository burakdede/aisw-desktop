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

export const APP_NAV_LABELS: Record<AppNavId, string> = {
  [APP_NAV_IDS.overview]: "Overview",
  [APP_NAV_IDS.profiles]: "Profiles",
  [APP_NAV_IDS.sets]: "Sets",
  [APP_NAV_IDS.diagnostics]: "Diagnostics",
  [APP_NAV_IDS.backups]: "Backups",
  [APP_NAV_IDS.activity]: "Activity",
  [APP_NAV_IDS.settings]: "Settings",
};

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

export const APP_NAV_SHORTCUT_KEYS: Record<string, DefaultAppSection> = {
  "1": APP_NAV_IDS.overview,
  "2": APP_NAV_IDS.profiles,
  "3": APP_NAV_IDS.sets,
  "4": APP_NAV_IDS.diagnostics,
  "5": APP_NAV_IDS.backups,
  "6": APP_NAV_IDS.activity,
};

export const APP_NAV_SHORTCUT_LABELS: Partial<Record<AppNavId, string>> = {
  [APP_NAV_IDS.overview]: "⌘1",
  [APP_NAV_IDS.profiles]: "⌘2",
  [APP_NAV_IDS.sets]: "⌘3",
  [APP_NAV_IDS.diagnostics]: "⌘4",
  [APP_NAV_IDS.backups]: "⌘5",
  [APP_NAV_IDS.activity]: "⌘6",
  [APP_NAV_IDS.settings]: "⌘,",
};

export const APP_NAV_ITEMS = [
  {
    id: APP_NAV_IDS.overview,
    label: APP_NAV_LABELS[APP_NAV_IDS.overview],
    group: APP_NAV_GROUPS.main,
    defaultSection: true,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.overview],
  },
  {
    id: APP_NAV_IDS.profiles,
    label: APP_NAV_LABELS[APP_NAV_IDS.profiles],
    group: APP_NAV_GROUPS.main,
    defaultSection: true,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.profiles],
  },
  {
    id: APP_NAV_IDS.sets,
    label: APP_NAV_LABELS[APP_NAV_IDS.sets],
    group: APP_NAV_GROUPS.main,
    defaultSection: true,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.sets],
  },
  {
    id: APP_NAV_IDS.diagnostics,
    label: APP_NAV_LABELS[APP_NAV_IDS.diagnostics],
    group: APP_NAV_GROUPS.health,
    defaultSection: true,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.diagnostics],
  },
  {
    id: APP_NAV_IDS.backups,
    label: APP_NAV_LABELS[APP_NAV_IDS.backups],
    group: APP_NAV_GROUPS.health,
    defaultSection: true,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.backups],
  },
  {
    id: APP_NAV_IDS.activity,
    label: APP_NAV_LABELS[APP_NAV_IDS.activity],
    group: APP_NAV_GROUPS.health,
    defaultSection: true,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.activity],
  },
  {
    id: APP_NAV_IDS.settings,
    label: APP_NAV_LABELS[APP_NAV_IDS.settings],
    group: APP_NAV_GROUPS.app,
    defaultSection: false,
    shortcut: APP_NAV_SHORTCUT_LABELS[APP_NAV_IDS.settings],
  },
] as const satisfies readonly AppNavItem[];

export const DEFAULT_APP_SECTIONS = APP_NAV_ITEMS.filter(
  (item): item is (typeof APP_NAV_ITEMS)[number] & { id: DefaultAppSection } => item.defaultSection,
).map((item) => item.id) as readonly DefaultAppSection[];

export function isAppNavId(value: string): value is AppNavId {
  return isOneOf(APP_NAV_ID_VALUES, value);
}
