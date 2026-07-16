import type { DesktopSettings } from "./schemas";

export const DESKTOP_UPDATE_CHANNELS = ["stable", "beta"] as const;
export type DesktopUpdateChannel = (typeof DESKTOP_UPDATE_CHANNELS)[number];
export const DEFAULT_DESKTOP_UPDATE_CHANNEL: DesktopUpdateChannel =
  DESKTOP_UPDATE_CHANNELS[0];

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  runtime_kind: "bundled",
  runtime_path: null,
  aisw_home: null,
  update_channel: DEFAULT_DESKTOP_UPDATE_CHANNEL,
  profile_labels: {},
  profile_sets: [],
};

export function isDesktopUpdateChannel(
  value: string | null | undefined,
): value is DesktopUpdateChannel {
  return Boolean(
    value &&
      DESKTOP_UPDATE_CHANNELS.includes(value as DesktopUpdateChannel),
  );
}

export function normalizeDesktopUpdateChannel(
  value: string | null | undefined,
): DesktopUpdateChannel {
  return isDesktopUpdateChannel(value)
    ? value
    : DEFAULT_DESKTOP_UPDATE_CHANNEL;
}

export function createDesktopSettings(
  overrides: Partial<DesktopSettings> = {},
): DesktopSettings {
  return {
    runtime_kind: overrides.runtime_kind ?? DEFAULT_DESKTOP_SETTINGS.runtime_kind,
    runtime_path:
      overrides.runtime_path !== undefined
        ? overrides.runtime_path
        : DEFAULT_DESKTOP_SETTINGS.runtime_path,
    aisw_home:
      overrides.aisw_home !== undefined
        ? overrides.aisw_home
        : DEFAULT_DESKTOP_SETTINGS.aisw_home,
    update_channel: normalizeDesktopUpdateChannel(overrides.update_channel),
    profile_labels: overrides.profile_labels ?? {},
    profile_sets: overrides.profile_sets ?? [],
  };
}

export function buildBundledRuntimeSettingsUpdate(
  settings: DesktopSettings,
): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: settings.aisw_home ?? null,
    update_channel: normalizeDesktopUpdateChannel(settings.update_channel),
    profile_labels: settings.profile_labels ?? {},
    profile_sets: settings.profile_sets ?? [],
  };
}
