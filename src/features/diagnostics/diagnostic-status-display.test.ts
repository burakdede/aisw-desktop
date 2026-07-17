import { describe, expect, it } from "vitest";
import {
  buildDiagnosticsStatusMessage,
  buildDiagnosticsSummary,
  formatRelativeVerifiedTime,
} from "./diagnostic-status-display";
import {
  DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
  DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL,
  DIAGNOSTICS_HEALTHY_TITLE,
} from "./diagnostics-copy";

describe("diagnostic-status-display", () => {
  it("builds diagnostics summary copy", () => {
    expect(buildDiagnosticsSummary(2, 1)).toEqual({
      title: "2 issues need attention",
      detail: "1 repair can be applied safely. 1 issue requires a decision.",
      tone: "warn",
      symbol: "▲",
    });
    expect(buildDiagnosticsSummary(0, 0)).toEqual({
      title: DIAGNOSTICS_HEALTHY_TITLE,
      detail: DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL,
      tone: "ok",
      symbol: "✓",
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
        exportErrorMessage: DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
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
        exportErrorMessage: DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
      }),
    ).toBe(DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE);
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
