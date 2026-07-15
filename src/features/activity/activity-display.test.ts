import { describe, expect, it } from "vitest";
import {
  activityGlobalScopeLabel,
  activityScopeLabel,
  activitySecondaryLine,
  activityStatusLabel,
  activityStatusSymbol,
  activityTrailingLine,
  filterActivity,
  formatActivityTimestamp,
  formatFullActivityTimestamp,
  groupActivityEntries,
  type ActivityEntry,
} from "./activity-display";

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    key: "entry-1",
    scopeLabel: "Claude Code",
    scopeType: "tool",
    scopeTool: "claude",
    label: "Use profile",
    status: "success",
    message: "Switched Claude Code to Personal2.",
    remediation: undefined,
    command: undefined,
    resultSummary: undefined,
    at: new Date("2026-07-15T12:00:00.000Z").getTime(),
    ...overrides,
  };
}

describe("activity-display", () => {
  it("shares scope and status labels", () => {
    expect(activityScopeLabel({ type: "tool", tool: "claude" })).toBe("Claude Code");
    expect(activityScopeLabel({ type: "global", id: "workspace" })).toBe("Project rules");
    expect(activityGlobalScopeLabel("profile-set")).toBe("Saved set");
    expect(activityGlobalScopeLabel("unknown")).toBe("App");
    expect(activityStatusLabel("success")).toBe("Success");
    expect(activityStatusLabel("error")).toBe("Failed");
    expect(activityStatusSymbol("success", "row")).toBe("✓");
    expect(activityStatusSymbol("success", "inspector")).toBe("●");
    expect(activityStatusSymbol("error", "row")).toBe("▲");
  });

  it("filters and groups activity entries", () => {
    const now = new Date("2026-07-15T15:00:00.000Z");
    const entries = [
      makeEntry({ key: "today", at: new Date("2026-07-15T12:00:00.000Z").getTime() }),
      makeEntry({
        key: "yesterday",
        status: "error",
        label: "Verify profile",
        message: "Verification failed.",
        at: new Date("2026-07-14T12:00:00.000Z").getTime(),
      }),
      makeEntry({
        key: "earlier",
        scopeType: "global",
        scopeTool: undefined,
        scopeLabel: "Settings",
        at: new Date("2026-07-10T12:00:00.000Z").getTime(),
      }),
    ];

    expect(filterActivity(entries, "verify", "all").map((entry) => entry.key)).toEqual(["yesterday"]);
    expect(filterActivity(entries, "", "error").map((entry) => entry.key)).toEqual(["yesterday"]);
    expect(groupActivityEntries(entries, now).map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Earlier",
    ]);
  });

  it("shares secondary lines, trailing lines, and timestamps", () => {
    expect(activitySecondaryLine(makeEntry())).toBe("Claude Code → Personal2");
    expect(
      activitySecondaryLine(
        makeEntry({
          message: "Profile Personal2 verified.",
        }),
      ),
    ).toBe("Claude Code · Personal2 verified");
    expect(
      activitySecondaryLine(
        makeEntry({
          scopeType: "global",
          scopeTool: undefined,
          scopeLabel: "Settings",
          resultSummary: "Saved runtime settings.",
        }),
      ),
    ).toBe("Saved runtime settings.");
    expect(activityTrailingLine(makeEntry({ remediation: "Retry" }))).toBe("Recovery available");
    expect(activityTrailingLine(makeEntry({ status: "error" }))).toBe("Failed");
    expect(activityTrailingLine(makeEntry({ resultSummary: "Saved runtime settings." }))).toBe(
      "Saved runtime settings.",
    );

    expect(
      formatActivityTimestamp(new Date("2026-07-15T12:05:00.000Z").getTime()).trim().length,
    ).toBeGreaterThan(0);
    expect(
      formatFullActivityTimestamp(
        new Date("2026-07-15T12:05:00.000Z").getTime(),
        new Date("2026-07-15T15:00:00.000Z"),
      ),
    ).toContain("Today at");
    expect(
      formatFullActivityTimestamp(
        new Date("2026-07-14T12:05:00.000Z").getTime(),
        new Date("2026-07-15T15:00:00.000Z"),
      ),
    ).toContain("Yesterday at");
    expect(formatFullActivityTimestamp(Number.NaN)).toBe("Date Unavailable");
  });
});
