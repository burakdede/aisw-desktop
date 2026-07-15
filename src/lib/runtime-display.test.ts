import { describe, expect, it } from "vitest";
import {
  INCLUDED_DESKTOP_ENGINE_LABEL,
  runtimeCompatibilityLabel,
  runtimeReadinessLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
  runtimeSummary,
} from "./runtime-display";

describe("runtime-display", () => {
  it("formats runtime source and selection labels", () => {
    expect(runtimeSelectionLabel("bundled")).toBe(INCLUDED_DESKTOP_ENGINE_LABEL);
    expect(runtimeSelectionLabel("system")).toBe("System engine");
    expect(runtimeSourceLabel("bundled")).toBe("Included");
    expect(runtimeSourceLabel("custom")).toBe("Custom override");
  });

  it("describes runtime summaries and compatibility copy", () => {
    expect(runtimeSummary("bundled").description).toContain("bundled with this app");
    expect(runtimeSummary("system").source).toBe("System override");
    expect(runtimeReadinessLabel(true)).toBe("Ready");
    expect(runtimeReadinessLabel(false)).toBe("Needs Attention");
    expect(runtimeReadinessLabel(false, "sentence")).toBe("Needs attention");
    expect(runtimeCompatibilityLabel(true)).toBe("Supported");
    expect(runtimeCompatibilityLabel(false)).toBe("Needs Attention");
  });
});
