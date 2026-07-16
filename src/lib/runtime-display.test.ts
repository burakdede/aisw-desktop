import { describe, expect, it } from "vitest";
import {
  CUSTOM_OVERRIDE_LABEL,
  INCLUDED_DESKTOP_ENGINE_LABEL,
  INCLUDED_RUNTIME_SOURCE_LABEL,
  SYSTEM_ENGINE_LABEL,
  SYSTEM_OVERRIDE_LABEL,
  runtimeCompatibilityLabel,
  runtimeReadinessLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
  runtimeSummary,
} from "./runtime-display";

describe("runtime-display", () => {
  it("formats runtime source and selection labels", () => {
    expect(runtimeSelectionLabel("bundled")).toBe(INCLUDED_DESKTOP_ENGINE_LABEL);
    expect(runtimeSelectionLabel("system")).toBe(SYSTEM_ENGINE_LABEL);
    expect(runtimeSourceLabel("bundled")).toBe(INCLUDED_RUNTIME_SOURCE_LABEL);
    expect(runtimeSourceLabel("custom")).toBe(CUSTOM_OVERRIDE_LABEL);
  });

  it("describes runtime summaries and compatibility copy", () => {
    expect(runtimeSummary("bundled").description).toContain("bundled with this app");
    expect(runtimeSummary("system").source).toBe(SYSTEM_OVERRIDE_LABEL);
    expect(runtimeReadinessLabel(true)).toBe("Ready");
    expect(runtimeReadinessLabel(false)).toBe("Needs Attention");
    expect(runtimeReadinessLabel(false, "sentence")).toBe("Needs attention");
    expect(runtimeCompatibilityLabel(true)).toBe("Supported");
    expect(runtimeCompatibilityLabel(false)).toBe("Needs Attention");
  });
});
