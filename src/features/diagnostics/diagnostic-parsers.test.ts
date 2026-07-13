import { describe, expect, it } from "vitest";
import { parseRepairActions } from "./diagnostic-parsers";

describe("parseRepairActions", () => {
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
