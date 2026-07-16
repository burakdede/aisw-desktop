import { describe, expect, it } from "vitest";
import {
  buildDiagnosticsStatusMessage,
  buildDiagnosticsSummary,
  formatRelativeVerifiedTime,
} from "./diagnostic-status-display";

describe("diagnostic-status-display", () => {
  it("builds diagnostics summary copy", () => {
    expect(buildDiagnosticsSummary(2, 1)).toEqual({
      title: "2 issues need attention",
      detail: "1 repair can be applied safely. 1 issue requires a decision.",
    });
    expect(buildDiagnosticsSummary(0, 0)).toEqual({
      title: "Everything looks good",
      detail: "All configured tools match their active AISW profiles and local storage checks passed.",
    });
  });

  it("formats relative verification times from shared thresholds", () => {
    expect(formatRelativeVerifiedTime(0)).toBe("Unavailable");
    expect(formatRelativeVerifiedTime(1000, 1005)).toBe("just now");
    expect(formatRelativeVerifiedTime(1000, 25_000)).toBe("24 sec ago");
    expect(formatRelativeVerifiedTime(1000, 181_000)).toBe("3 min ago");
    expect(formatRelativeVerifiedTime(1000, 7_201_000)).toBe("2 hr ago");
    expect(formatRelativeVerifiedTime(1000, 172_801_000)).toBe("2 days ago");
  });

  it("builds diagnostics footer status messages with stable precedence", () => {
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "Copied bundle path /tmp/report.zip.",
        exportedBundle: { filename: "report.zip", path: "/tmp/report.zip" },
        exportErrorMessage: "Support report export failed.",
        appliedFixCount: 2,
      }),
    ).toBe("Copied bundle path /tmp/report.zip.");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
        exportedBundle: { filename: "report.zip", path: "/tmp/report.zip" },
      }),
    ).toBe("Support report ready: report.zip. /tmp/report.zip");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
        exportErrorMessage: "Support report export failed.",
      }),
    ).toBe("Support report export failed.");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
        appliedFixCount: 2,
      }),
    ).toBe("Applied 2 safe fixes.");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
      }),
    ).toBe("");
  });
});
