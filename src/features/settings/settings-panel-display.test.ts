import { describe, expect, it } from "vitest";
import { DesktopCommandError } from "../../lib/tauri";
import type { AppBootstrap, DesktopSettings } from "../../lib/schemas";
import {
  effectiveRuntimePath,
  findShellHookCheck,
  formatSettingsMutationError,
  LAUNCH_AT_LOGIN_DISABLED_MESSAGE,
  LAUNCH_AT_LOGIN_ENABLED_MESSAGE,
  selectedRuntimePath,
  WINDOW_LAYOUT_RESET_MESSAGE,
} from "./settings-panel-display";

function makeSettings(overrides: Partial<DesktopSettings> = {}): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {},
    profile_sets: [],
    ...overrides,
  };
}

function makeRuntimeStatus(
  overrides: Partial<AppBootstrap["runtime_status"]> = {},
): AppBootstrap["runtime_status"] {
  return {
    resolved_path: null,
    version: null,
    capabilities: null,
    inventory: {
      bundled_path: "/Applications/AI Switcher.app/Contents/MacOS/aisw",
      system_path: "/opt/homebrew/bin/aisw",
      configured_path: null,
    },
    compatible: true,
    issues: [],
    ...overrides,
  };
}

describe("settings-panel-display", () => {
  it("shares stable settings feedback copy", () => {
    expect(LAUNCH_AT_LOGIN_ENABLED_MESSAGE).toBe("Launch at login enabled.");
    expect(LAUNCH_AT_LOGIN_DISABLED_MESSAGE).toBe("Launch at login disabled.");
    expect(WINDOW_LAYOUT_RESET_MESSAGE).toBe("Cleared the saved window size and position.");
  });

  it("shares normalized mutation errors and shell checks", () => {
    expect(
      formatSettingsMutationError(
        new DesktopCommandError("AISW cannot load CLI context.", {
          remediation: "Re-open aisw and verify the imported context.",
        }),
      ),
    ).toEqual({
      message: "AI Switch cannot load set.",
      remediation: "Re-open AI Switch and verify the set.",
    });
    expect(formatSettingsMutationError(new Error("AISW cannot update runtime."))).toEqual({
      message: "AI Switch cannot update runtime.",
      remediation: undefined,
    });

    expect(
      findShellHookCheck({
        checks: [
          { name: "workspace", status: "pass", detail: "ignored" },
          {
            name: "shell hook",
            status: "fail",
            detail: "Shell hook guidance remains informational.",
          },
        ],
      }),
    ).toEqual({
      status: "fail",
      detail: "Terminal integration guidance remains informational.",
    });
    expect(findShellHookCheck(undefined)).toBeNull();
  });

  it("shares effective and resolved runtime paths", () => {
    expect(effectiveRuntimePath("bundled", "/tmp/aisw")).toBe("");
    expect(effectiveRuntimePath("custom", "/tmp/aisw")).toBe("/tmp/aisw");

    expect(selectedRuntimePath(makeSettings(), makeRuntimeStatus())).toBe(
      "/Applications/AI Switcher.app/Contents/MacOS/aisw",
    );
    expect(
      selectedRuntimePath(makeSettings({ runtime_kind: "system" }), makeRuntimeStatus()),
    ).toBe("/opt/homebrew/bin/aisw");
    expect(
      selectedRuntimePath(
        makeSettings({ runtime_kind: "custom", runtime_path: "/Users/test/bin/aisw" }),
        makeRuntimeStatus(),
      ),
    ).toBe("/Users/test/bin/aisw");
  });
});
