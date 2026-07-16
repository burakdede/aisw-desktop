import { describe, expect, it } from "vitest";
import {
  doctorCheckHasKeyword,
  doctorCheckNameHasAll,
  parseDoctorChecks,
  parseDoctorReportChecks,
} from "./diagnostic-doctor-checks";

describe("diagnostic-doctor-checks", () => {
  it("parses doctor checks with shared defaults and normalized fields", () => {
    const checks = parseDoctorChecks(
      {
        checks: [
          { name: "shell hook", detail: "Shell hook is not active.", status: "fail" },
          { name: "keyring" },
          "ignore-me",
        ],
      },
      {
        defaultDetail: "No detail",
        detailTransform: (detail) => detail.replace("Shell hook", "Terminal integration"),
      },
    );

    expect(checks).toEqual([
      {
        name: "shell hook",
        detail: "Terminal integration is not active.",
        status: "fail",
        normalizedName: "shell hook",
        normalizedDetail: "terminal integration is not active.",
      },
      {
        name: "keyring",
        detail: "No detail",
        status: "warn",
        normalizedName: "keyring",
        normalizedDetail: "no detail",
      },
    ]);
  });

  it("matches shared doctor-check keywords against normalized names and details", () => {
    const [shellCheck] = parseDoctorChecks({
      checks: [{ name: "shell hook", detail: "Terminal integration is not active." }],
    });

    expect(doctorCheckNameHasAll(shellCheck, ["shell", "hook"])).toBe(true);
    expect(doctorCheckHasKeyword(shellCheck, "terminal integration")).toBe(true);
    expect(doctorCheckHasKeyword(shellCheck, "keyring")).toBe(false);
  });

  it("parses full doctor reports including passing checks", () => {
    expect(
      parseDoctorReportChecks({
        checks: [
          { name: "oauth_permission", detail: "Permission checks passed.", status: "pass" },
          { name: "shell hook", detail: "Shell hook is not active.", status: "warn" },
        ],
      }),
    ).toEqual([
      {
        name: "oauth_permission",
        detail: "Permission checks passed.",
        status: "pass",
        normalizedName: "oauth_permission",
        normalizedDetail: "permission checks passed.",
      },
      {
        name: "shell hook",
        detail: "Shell hook is not active.",
        status: "warn",
        normalizedName: "shell hook",
        normalizedDetail: "shell hook is not active.",
      },
    ]);
  });
});
