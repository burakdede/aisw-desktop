import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FILTER_OPTIONS,
  activityGlobalScopeLabel,
  activitySecondaryLine,
  activityScopeLabel,
  activityStatusLabel,
  activityStatusSymbol,
  activityTrailingLine,
  buildActivityEntries,
  buildActivityExportBody,
  buildActivityExportMessage,
  filterActivity,
  formatActivityTimestamp,
  formatFullActivityTimestamp,
  groupActivityEntries,
  resolveSelectedActivityEntryKey,
  type ActivityEntry,
} from "./activity-display";
import type { ActivityTimelineEntry } from "../shared/lastCommandResult";

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
    expect(ACTIVITY_FILTER_OPTIONS).toEqual([
      { value: "all", label: "All" },
      { value: "success", label: "Success" },
      { value: "error", label: "Failed" },
    ]);
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

  it("maps timeline entries and preserves the selected entry when possible", () => {
    const timeline: ActivityTimelineEntry[] = [
      {
        key: "entry-1",
        scope: { type: "tool", tool: "claude" },
        label: "Use profile",
        status: "success",
        message: "Switched Claude Code to Personal2.",
        remediation: undefined,
        command: "aisw use claude personal2",
        resultSummary: "Snapshot updated successfully.",
        at: new Date("2026-07-15T12:00:00.000Z").getTime(),
      },
      {
        key: "entry-2",
        scope: { type: "global", id: "settings" },
        label: "Save settings",
        status: "error",
        message: "Settings update failed.",
        remediation: "Try again",
        command: undefined,
        resultSummary: undefined,
        at: new Date("2026-07-15T12:10:00.000Z").getTime(),
      },
    ];

    const entries = buildActivityEntries(timeline);
    expect(entries).toEqual([
      makeEntry({
        command: "aisw use claude personal2",
        resultSummary: "Snapshot updated successfully.",
      }),
      makeEntry({
        key: "entry-2",
        scopeLabel: "Settings",
        scopeType: "global",
        scopeTool: undefined,
        label: "Save settings",
        status: "error",
        message: "Settings update failed.",
        remediation: "Try again",
        at: new Date("2026-07-15T12:10:00.000Z").getTime(),
      }),
    ]);

    expect(resolveSelectedActivityEntryKey("entry-2", entries)).toBe("entry-2");
    expect(resolveSelectedActivityEntryKey("missing", entries)).toBe("entry-1");
    expect(resolveSelectedActivityEntryKey(null, [])).toBeNull();
  });

  it("builds export payload and message with stable formatting", () => {
    const body = buildActivityExportBody([
      makeEntry({
        at: new Date("2026-07-15T12:05:00.000Z").getTime(),
      }),
    ]);

    expect(JSON.parse(body)).toEqual([
      expect.objectContaining({
        key: "entry-1",
        recordedAt: "2026-07-15T12:05:00.000Z",
      }),
    ]);
    expect(buildActivityExportMessage("activity-log-123.json")).toBe("Opened activity-log-123.json.");
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
