import { describe, expect, it } from "vitest";
import {
  diagnosticExportFailureMessage,
  diagnosticExportFailureNotification,
  diagnosticExportedMessage,
  diagnosticExportSuccessNotification,
  DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
  DIAGNOSTICS_EXPORT_REPORT_FAILED_TITLE,
  DIAGNOSTICS_EXPORT_REPORT_TITLE,
} from "./diagnostics-copy";

describe("diagnostics-copy", () => {
  it("shares stable diagnostic export success copy", () => {
    expect(diagnosticExportedMessage("report.zip")).toBe("Saved report.zip.");
    expect(diagnosticExportSuccessNotification("report.zip")).toEqual({
      title: DIAGNOSTICS_EXPORT_REPORT_TITLE,
      body: "Saved report.zip.",
    });
  });

  it("shares stable diagnostic export failure copy", () => {
    expect(diagnosticExportFailureMessage(new Error("Disk unavailable"))).toBe(
      "Disk unavailable",
    );
    expect(diagnosticExportFailureMessage(null)).toBe(
      DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
    );
    expect(diagnosticExportFailureNotification(null)).toEqual({
      title: DIAGNOSTICS_EXPORT_REPORT_FAILED_TITLE,
      body: DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
    });
  });
});
