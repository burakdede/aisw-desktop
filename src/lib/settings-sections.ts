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

export const SETTINGS_SECTIONS = [
  SETTINGS_SECTION_IDS.general,
  SETTINGS_SECTION_IDS.runtime,
  SETTINGS_SECTION_IDS.shell,
  SETTINGS_SECTION_IDS.keyring,
  SETTINGS_SECTION_IDS.updates,
  SETTINGS_SECTION_IDS.advanced,
] as const;

export const DEFAULT_SETTINGS_SECTION: SettingsSection = SETTINGS_SECTIONS[0];

export function normalizeSettingsSection(
  value: unknown,
  fallback: SettingsSection = DEFAULT_SETTINGS_SECTION,
): SettingsSection {
  return normalizeOneOf(SETTINGS_SECTIONS, value, fallback);
}
