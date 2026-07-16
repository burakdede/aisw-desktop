import { describe, expect, it } from "vitest";
import { DesktopCommandError } from "./tauri";
import { resolveErrorDetails } from "./error-details";

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
  });
});
