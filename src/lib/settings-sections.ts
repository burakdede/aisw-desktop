import { normalizeOneOf } from "./parse-guards";

export const SETTINGS_SECTION_IDS = {
  general: "general",
  runtime: "runtime",
  shell: "shell",
  keyring: "keyring",
  updates: "updates",
  advanced: "advanced",
} as const;

export type SettingsSection =
  (typeof SETTINGS_SECTION_IDS)[keyof typeof SETTINGS_SECTION_IDS];

const SETTINGS_SECTION_DEFINITIONS = [
  {
    id: SETTINGS_SECTION_IDS.general,
    label: "General",
  },
  {
    id: SETTINGS_SECTION_IDS.runtime,
    label: "Engine",
  },
  {
    id: SETTINGS_SECTION_IDS.shell,
    label: "Terminal Integration",
  },
  {
    id: SETTINGS_SECTION_IDS.keyring,
    label: "Security",
  },
  {
    id: SETTINGS_SECTION_IDS.updates,
    label: "Updates",
  },
  {
    id: SETTINGS_SECTION_IDS.advanced,
    label: "Advanced",
  },
] as const satisfies ReadonlyArray<{
  id: SettingsSection;
  label: string;
}>;

export const SETTINGS_SECTIONS = SETTINGS_SECTION_DEFINITIONS.map(
  (section) => section.id,
) as readonly SettingsSection[];

export const DEFAULT_SETTINGS_SECTION: SettingsSection = SETTINGS_SECTIONS[0];

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = Object.fromEntries(
  SETTINGS_SECTION_DEFINITIONS.map((section) => [section.id, section.label]),
) as Record<SettingsSection, string>;

export function normalizeSettingsSection(
  value: unknown,
  fallback: SettingsSection = DEFAULT_SETTINGS_SECTION,
): SettingsSection {
  return normalizeOneOf(SETTINGS_SECTIONS, value, fallback);
}

export function settingsSectionLabel(section: SettingsSection) {
  return SETTINGS_SECTION_LABELS[section];
}
