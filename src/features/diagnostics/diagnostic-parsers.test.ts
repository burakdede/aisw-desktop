import { describe, expect, it } from "vitest";
import {
  parseDoctorSummary,
  parseRepairActions,
  parseVerifySummary,
} from "./diagnostic-parsers";

describe("parseRepairActions", () => {
  it("normalizes doctor and verify summary statuses", () => {
    expect(
      parseDoctorSummary({
        checks: [
          { status: "pass" },
          { status: "warn" },
          { status: "fail" },
          { status: "invalid" },
        ],
      }),
    ).toEqual({
      title: "Health scan",
      status: "fail",
      lines: ["4 checks", "1 pass", "1 warn", "1 fail"],
    });

    expect(
      parseVerifySummary({
        summary: { status: "invalid", passed: 1, warnings: 0, failed: 0 },
      }),
    ).toEqual({
      title: "Live match",
      status: "unknown",
      lines: ["1 passed", "0 warnings", "0 failed"],
    });
  });

  it("dedupes duplicate safe fixes for the same target", () => {
    const actions = parseRepairActions({
      result: {
        actions: [
          {
            kind: "repair",
            fix: "permissions",
            path: "~/.aisw/config.json",
            detail: "repair config path permissions",
            status: "planned",
          },
          {
            kind: "repair",
            fix: "permissions",
            path: "~/.aisw/config.json",
            detail: "repair config path permissions",
            status: "planned",
          },
          {
            kind: "repair",
            fix: "keyring",
            path: "~/.aisw",
            detail: "unlock the system keyring integration",
            status: "planned",
          },
        ],
      },
    });

    expect(actions).toEqual([
      {
        title: "Repair permissions",
        detail: "2 AISW-managed items need permission repair.",
        status: "planned",
        fix: "permissions",
        count: 2,
      },
      {
        title: "Unlock keyring integration",
        detail: "Reconnect AI Switch to the local system keyring service.",
        status: "planned",
        fix: "keyring",
        count: 1,
      },
    ]);
  });

  it("keeps distinct targets as separate actions", () => {
    const actions = parseRepairActions({
      result: {
        actions: [
          {
            kind: "repair",
            fix: "permissions",
            path: "~/.aisw/config.json",
            detail: "repair config path permissions",
            status: "planned",
          },
          {
            kind: "repair",
            fix: "permissions",
            path: "~/.aisw/history.json",
            detail: "repair history path permissions",
            status: "planned",
          },
        ],
      },
    });

    expect(actions).toHaveLength(2);
    expect(actions.every((action) => action.title === "Repair permissions")).toBe(true);
    expect(actions.every((action) => action.count === 1)).toBe(true);
  });
});
