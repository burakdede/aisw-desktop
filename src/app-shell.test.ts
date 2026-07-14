import {
  describeBootstrapError,
  describeRuntimeBlocker,
  navShortcutLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
  sectionTitle,
  settingsForRecovery,
} from "./app-shell";
import { DesktopCommandError } from "./lib/tauri";

describe("app-shell helpers", () => {
  it("returns the default recovery settings when bootstrap settings are missing", () => {
    expect(settingsForRecovery(undefined)).toMatchObject({
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
    });
  });

  it("maps section shortcuts and labels", () => {
    expect(navShortcutLabel("overview")).toBe("⌘1");
    expect(navShortcutLabel("settings")).toBe("⌘,");
    expect(navShortcutLabel("unknown")).toBeUndefined();
    expect(sectionTitle("profiles")).toBe("Profiles");
    expect(sectionTitle("overview", true)).toBe("Get started");
  });

  it("formats bootstrap and runtime errors for the shell", () => {
    expect(
      describeBootstrapError(
        new DesktopCommandError("Broken", { remediation: "Repair it" }),
      ),
    ).toEqual({
      message: "Broken",
      remediation: "Repair it",
    });

    expect(describeBootstrapError(new Error("Oops"))).toEqual({
      message: "Oops",
      remediation: undefined,
    });

    expect(describeBootstrapError(null)).toEqual({
      message: "AI Switch could not load its local desktop state.",
      remediation: undefined,
    });
  });

  it("describes runtime blockers based on compatibility evidence", () => {
    expect(
      describeRuntimeBlocker({
        resolved_path: "/bin/aisw",
        version: null,
        capabilities: null,
        issues: ["aisw version info is unavailable"],
      }).nextStep,
    ).toContain("desktop-compatible");

    expect(
      describeRuntimeBlocker({
        resolved_path: "/bin/aisw",
        version: { version: "0.3.7" },
        capabilities: { features: {} },
        issues: ["unsupported feature"],
      }).summary,
    ).toContain("not compatible");

    expect(
      describeRuntimeBlocker({
        resolved_path: null,
        version: null,
        capabilities: null,
        issues: [],
      }).summary,
    ).toContain("could not use");
  });

  it("formats runtime labels for the shell", () => {
    expect(runtimeSelectionLabel("bundled")).toBe("Included desktop engine");
    expect(runtimeSelectionLabel("system")).toBe("System engine");
    expect(runtimeSourceLabel("bundled")).toBe("Included");
    expect(runtimeSourceLabel("custom")).toBe("Custom override");
  });
});
