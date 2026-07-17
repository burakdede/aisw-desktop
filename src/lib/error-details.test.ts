import { describe, expect, it } from "vitest";
import { normalizeRuntimeLanguage } from "../features/shared/runtime-language";
import { DesktopCommandError } from "./tauri";
import {
  formatResolvedErrorMessage,
  resolveErrorDetails,
  resolveErrorMessage,
  resolveNormalizedErrorDetails,
} from "./error-details";

describe("error-details", () => {
  it("extracts desktop command details when available", () => {
    expect(
      resolveErrorDetails(
        new DesktopCommandError("Broken", {
          kind: "ProfileMissing",
          remediation: "Repair it",
        }),
        "Fallback",
      ),
    ).toEqual({
      message: "Broken",
      kind: "ProfileMissing",
      remediation: "Repair it",
    });
  });

  it("handles generic errors, strings, plain objects, and fallback values", () => {
    expect(resolveErrorDetails(new Error("Oops"), "Fallback")).toEqual({
      message: "Oops",
      kind: undefined,
      remediation: undefined,
    });
    expect(resolveErrorDetails("String failure", "Fallback")).toEqual({
      message: "String failure",
    });
    expect(
      resolveErrorDetails(
        { message: "Object failure", remediation: "Retry", kind: "object_failure" },
        "Fallback",
      ),
    ).toEqual({
      message: "Object failure",
      remediation: "Retry",
      kind: "object_failure",
    });
    expect(resolveErrorDetails(null, "Fallback")).toEqual({
      message: "Fallback",
    });
    expect(resolveErrorMessage(new Error("Oops"), "Fallback")).toBe("Oops");
    expect(resolveErrorMessage({ message: "Object failure" }, "Fallback")).toBe(
      "Object failure",
    );
    expect(resolveErrorMessage(null, "Fallback")).toBe("Fallback");
  });

  it("shares normalized and formatted error presentation helpers", () => {
    expect(
      resolveNormalizedErrorDetails(
        {
          message: "AISW cannot load CLI context.",
          remediation: "Re-open aisw and verify the imported context.",
        },
        "Fallback",
        normalizeRuntimeLanguage,
      ),
    ).toEqual({
      message: "AI Switch cannot load set.",
      remediation: "Re-open AI Switch and verify the set.",
      kind: undefined,
    });

    expect(
      formatResolvedErrorMessage(
        new DesktopCommandError("AISW failed.", { remediation: "Run aisw verify." }),
        "Fallback",
        { normalizeText: normalizeRuntimeLanguage },
      ),
    ).toBe("AI Switch failed. Remediation: Run AI Switch verify.");

    expect(
      formatResolvedErrorMessage(
        new DesktopCommandError("Broken", { remediation: "Repair it" }),
        "Fallback",
        { remediationPrefix: "" },
      ),
    ).toBe("Broken Repair it");
  });
});
