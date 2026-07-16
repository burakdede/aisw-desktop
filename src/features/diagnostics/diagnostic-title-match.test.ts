import { describe, expect, it } from "vitest";
import {
  diagnosticTitleHas,
  diagnosticTitleHasAny,
  normalizeDiagnosticTitle,
} from "./diagnostic-title-match";

describe("diagnostic-title-match", () => {
  it("normalizes diagnostic titles before keyword matching", () => {
    expect(normalizeDiagnosticTitle("  Claude Live Mismatch  ")).toBe("claude live mismatch");
    expect(normalizeDiagnosticTitle(undefined)).toBe("");
  });

  it("shares keyword matching for known diagnostic title patterns", () => {
    expect(diagnosticTitleHas("Claude live mismatch", "liveMismatch")).toBe(true);
    expect(diagnosticTitleHas("Claude profile missing", "profileMissing")).toBe(true);
    expect(diagnosticTitleHas("Keyring unavailable", "keyring")).toBe(true);
    expect(diagnosticTitleHas("Permission issue", "permission")).toBe(true);
    expect(diagnosticTitleHas("OAuth timeout", "oauth")).toBe(true);
    expect(diagnosticTitleHas("Terminal setup required", "setup")).toBe(true);
    expect(
      diagnosticTitleHasAny("Terminal setup required", ["shell", "setup", "missing"]),
    ).toBe(true);
    expect(diagnosticTitleHasAny("Healthy state", ["project", "missing"])).toBe(false);
  });
});
