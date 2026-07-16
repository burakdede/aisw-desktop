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

export const APP_NAV_LABELS: Record<AppNavId, string> = {
  [APP_NAV_IDS.overview]: "Overview",
  [APP_NAV_IDS.profiles]: "Profiles",
  [APP_NAV_IDS.sets]: "Sets",
  [APP_NAV_IDS.diagnostics]: "Diagnostics",
  [APP_NAV_IDS.backups]: "Backups",
  [APP_NAV_IDS.activity]: "Activity",
  [APP_NAV_IDS.settings]: "Settings",
};

export const DEFAULT_APP_SECTIONS = [
  APP_NAV_IDS.overview,
  APP_NAV_IDS.profiles,
  APP_NAV_IDS.sets,
  APP_NAV_IDS.diagnostics,
  APP_NAV_IDS.backups,
  APP_NAV_IDS.activity,
] as const;

export type DefaultAppSection = (typeof DEFAULT_APP_SECTIONS)[number];

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
