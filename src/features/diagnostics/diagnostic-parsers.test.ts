import { describe, expect, it } from "vitest";
import { DIAGNOSTICS_REPAIR_PLAN_LABEL } from "./diagnostics-copy";
import {
  parseDoctorSummary,
  parseRepairActionRecords,
  parseRepairActions,
  parseRepairSummary,
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
    expect(
      parseRepairSummary({
        result: {
          summary: {
            status: "warn",
            actions_planned: 2,
            actions_applied: 1,
            issues_remaining: 3,
          },
        },
      }),
    ).toEqual({
      title: DIAGNOSTICS_REPAIR_PLAN_LABEL,
      status: "warn",
      lines: ["2 actions planned", "1 applied", "3 issues remaining"],
    });
  });

  it("dedupes duplicate safe fixes for the same target", () => {
    expect(
      parseRepairActionRecords({
        result: {
          actions: [
            { fix: "permissions", path: "~/.aisw/config.json" },
            "invalid",
          ],
        },
      }),
    ).toEqual([{ fix: "permissions", path: "~/.aisw/config.json" }]);

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
        fix: "permissions",
        count: 2,
      },
      {
        title: "Unlock keyring integration",
        detail: "Reconnect AI Switch to the local system keyring service.",
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
