import { describe, expect, it } from "vitest";
import {
  buildBundledRuntimeSettingsUpdate,
  createDesktopSettings,
  DEFAULT_DESKTOP_SETTINGS,
  DESKTOP_RUNTIME_KINDS,
  DEFAULT_DESKTOP_UPDATE_CHANNEL,
  DESKTOP_UPDATE_CHANNELS,
  normalizeDesktopRuntimeKind,
  normalizeDesktopUpdateChannel,
} from "./desktop-settings";

describe("desktop-settings", () => {
  it("shares the supported desktop update channels", () => {
    expect(DESKTOP_RUNTIME_KINDS).toEqual(["bundled", "system", "custom"]);
    expect(DESKTOP_UPDATE_CHANNELS).toEqual(["stable", "beta"]);
    expect(DEFAULT_DESKTOP_UPDATE_CHANNEL).toBe("stable");
  });

  it("creates normalized desktop settings defaults", () => {
    expect(createDesktopSettings()).toEqual(DEFAULT_DESKTOP_SETTINGS);
    expect(
      createDesktopSettings({
        runtime_kind: "custom",
        runtime_path: "/tmp/aisw",
        update_channel: "beta",
      }),
    ).toEqual({
      runtime_kind: "custom",
      runtime_path: "/tmp/aisw",
      aisw_home: null,
      update_channel: "beta",
      profile_labels: {},
      profile_sets: [],
    });
    expect(normalizeDesktopUpdateChannel("nightly")).toBe("stable");
    expect(normalizeDesktopRuntimeKind("custom")).toBe("custom");
    expect(normalizeDesktopRuntimeKind("bad")).toBe("bundled");
    expect(normalizeDesktopRuntimeKind("bad", "system")).toBe("system");
  });

  it("builds the bundled runtime settings update from existing settings", () => {
    expect(
      buildBundledRuntimeSettingsUpdate(
        createDesktopSettings({
          runtime_kind: "custom",
          runtime_path: "/tmp/aisw",
          aisw_home: "/tmp/home",
          update_channel: "beta",
          profile_labels: { claude: { work: "Work" } },
          profile_sets: [{ name: "work", label: "Work", profiles: { claude: "work" } }],
        }),
      ),
    ).toEqual({
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: "/tmp/home",
      update_channel: "beta",
      profile_labels: { claude: { work: "Work" } },
      profile_sets: [{ name: "work", label: "Work", profiles: { claude: "work" } }],
    });
  });
});
