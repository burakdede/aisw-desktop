import { isOneOf, nullishToNull } from "./parse-guards";
import type { DesktopSettings } from "./schemas";

export const DESKTOP_RUNTIME_KINDS = ["bundled", "system", "custom"] as const;
export type DesktopRuntimeKind = (typeof DESKTOP_RUNTIME_KINDS)[number];
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

function resolveNullableDesktopSetting<Value>(
  override: Value | null | undefined,
  fallback: Value | null,
) {
  return override !== undefined ? nullishToNull(override) : fallback;
}

export function isDesktopUpdateChannel(
  value: string | null | undefined,
): value is DesktopUpdateChannel {
  return isOneOf(DESKTOP_UPDATE_CHANNELS, value);
}

export function normalizeDesktopUpdateChannel(
  value: string | null | undefined,
): DesktopUpdateChannel {
  return isDesktopUpdateChannel(value)
    ? value
    : DEFAULT_DESKTOP_UPDATE_CHANNEL;
}

export function normalizeDesktopRuntimeKind(
  value: unknown,
  fallback: DesktopRuntimeKind = DEFAULT_DESKTOP_SETTINGS.runtime_kind,
): DesktopRuntimeKind {
  return isOneOf(DESKTOP_RUNTIME_KINDS, value) ? value : fallback;
}

export function createDesktopSettings(
  overrides: Partial<DesktopSettings> = {},
): DesktopSettings {
  return {
    runtime_kind: overrides.runtime_kind ?? DEFAULT_DESKTOP_SETTINGS.runtime_kind,
    runtime_path: resolveNullableDesktopSetting(
      overrides.runtime_path,
      DEFAULT_DESKTOP_SETTINGS.runtime_path,
    ),
    aisw_home: resolveNullableDesktopSetting(
      overrides.aisw_home,
      DEFAULT_DESKTOP_SETTINGS.aisw_home,
    ),
    update_channel: normalizeDesktopUpdateChannel(overrides.update_channel),
    profile_labels: overrides.profile_labels ?? {},
    profile_sets: overrides.profile_sets ?? [],
  };
}

export function buildDesktopSettingsUpdate(
  settings: DesktopSettings,
  overrides: Partial<DesktopSettings> = {},
): DesktopSettings {
  return {
    runtime_kind: overrides.runtime_kind ?? settings.runtime_kind,
    runtime_path: resolveNullableDesktopSetting(overrides.runtime_path, nullishToNull(settings.runtime_path)),
    aisw_home: resolveNullableDesktopSetting(overrides.aisw_home, nullishToNull(settings.aisw_home)),
    update_channel: normalizeDesktopUpdateChannel(
      overrides.update_channel ?? settings.update_channel,
    ),
    profile_labels: overrides.profile_labels ?? settings.profile_labels ?? {},
    profile_sets: overrides.profile_sets ?? settings.profile_sets ?? [],
  };
}

export function buildBundledRuntimeSettingsUpdate(
  settings: DesktopSettings,
): DesktopSettings {
  return buildDesktopSettingsUpdate(settings, {
    runtime_kind: "bundled",
    runtime_path: null,
  });
}
