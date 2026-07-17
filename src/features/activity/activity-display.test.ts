import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CLEAR_DIALOG,
  ACTIVITY_EMPTY_SELECTION_STATE,
  ACTIVITY_EMPTY_STATE,
  ACTIVITY_FILTER_OPTIONS,
  ACTIVITY_INSPECTOR_COPY,
  ACTIVITY_PANEL_COPY,
  ACTIVITY_STATUS_NOTIFICATION,
  ACTIVITY_TOOLBAR_COPY,
  activityEntryAriaLabel,
  activityFooterMessage,
  activityRecordedCommand,
  activityRecordedResult,
  activityGlobalScopeLabel,
  activityScopePresentation,
  activitySecondaryLine,
  activityScopeLabel,
  activityStatusLabel,
  activityStatusPresentation,
  activityStatusSymbol,
  buildActivityInspectorRows,
  buildActivityScopeValue,
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
import { SNAPSHOT_UPDATED_RESULT_SUMMARY } from "../shared/command-result-payload";
import { COMMAND_RESULT_GLOBAL_IDS } from "../shared/command-result-scope";
import { DESKTOP_ACTION_RESULT_COPY } from "../shared/desktop-action-result-copy";
import type { ActivityTimelineEntry } from "../shared/lastCommandResult";

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    key: "entry-1",
    scopeLabel: "Claude Code",
    scopeType: "tool",
    scopeTool: "claude",
    label: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
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
    expect(
      activityScopeLabel({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.workspace }),
    ).toBe("Project rules");
    expect(activityGlobalScopeLabel(COMMAND_RESULT_GLOBAL_IDS.profileSet)).toBe("Saved set");
    expect(activityGlobalScopeLabel("unknown")).toBe("App");
    expect(activityStatusLabel("success")).toBe("Success");
    expect(activityStatusLabel("error")).toBe("Failed");
    expect(activityStatusPresentation("success", "row")).toEqual({
      label: "Success",
      symbol: "✓",
      tone: "success",
    });
    expect(activityStatusPresentation("error", "inspector")).toEqual({
      label: "Failed",
      symbol: "▲",
      tone: "error",
    });
    expect(activityStatusSymbol("success", "row")).toBe("✓");
    expect(activityStatusSymbol("success", "inspector")).toBe("●");
    expect(activityStatusSymbol("error", "row")).toBe("▲");
    expect(buildActivityScopeValue(makeEntry())).toBe("Claude Code");
    expect(activityScopePresentation(makeEntry())).toEqual({
      brandTool: "claude",
      value: "Claude Code",
    });
    expect(ACTIVITY_PANEL_COPY.listAriaLabel).toBe("Activity timeline");
    expect(ACTIVITY_PANEL_COPY.backLabel).toBe("Back");
    expect(ACTIVITY_PANEL_COPY.cancelLabel).toBe("Cancel");
    expect(activityEntryAriaLabel(makeEntry())).toBe("Inspect Use profile");
    expect(
      activityScopePresentation(
        makeEntry({
          scopeType: "global",
          scopeTool: undefined,
          scopeLabel: "Settings",
        }),
      ),
    ).toEqual({
      value: "Settings",
    });
    expect(
      buildActivityScopeValue(
        makeEntry({
          scopeType: "global",
          scopeTool: undefined,
          scopeLabel: "Settings",
        }),
      ),
    ).toBe("Settings");
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
        label: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
        status: "success",
        message: "Switched Claude Code to Personal2.",
        remediation: undefined,
        command: "aisw use claude personal2",
        resultSummary: SNAPSHOT_UPDATED_RESULT_SUMMARY,
        at: new Date("2026-07-15T12:00:00.000Z").getTime(),
      },
      {
        key: "entry-2",
        scope: { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.settings },
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
        resultSummary: SNAPSHOT_UPDATED_RESULT_SUMMARY,
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

  it("shares copy and inspector fallbacks", () => {
    expect(ACTIVITY_TOOLBAR_COPY.searchPlaceholder).toBe("Search activity…");
    expect(ACTIVITY_TOOLBAR_COPY.clearLabel).toBe("Clear Activity History…");
    expect(ACTIVITY_STATUS_NOTIFICATION.logOpened).toBe("Activity log opened");
    expect(ACTIVITY_STATUS_NOTIFICATION.clearMessage).toBe("Cleared locally stored desktop activity.");
    expect(ACTIVITY_EMPTY_STATE.heading).toBe("No recent activity");
    expect(ACTIVITY_EMPTY_SELECTION_STATE.heading).toBe("No event selected");
    expect(ACTIVITY_CLEAR_DIALOG.confirmLabel).toBe("Clear History");
    expect(ACTIVITY_INSPECTOR_COPY.commandHeading).toBe("Recorded Command");

    expect(activityFooterMessage("Opened activity-log.json.")).toBe(
      "Activity is stored locally and credentials are always redacted. Opened activity-log.json.",
    );
    expect(activityFooterMessage("")).toBe(
      "Activity is stored locally and credentials are always redacted.",
    );

    expect(activityRecordedCommand(makeEntry())).toBe(
      "Command details were not recorded for this event.",
    );
    expect(activityRecordedResult(makeEntry())).toBe(SNAPSHOT_UPDATED_RESULT_SUMMARY);
    expect(activityRecordedResult(makeEntry({ status: "error" }))).toBe(
      "No redacted result payload was recorded for this event.",
    );

    expect(
      buildActivityInspectorRows(
        makeEntry({
          remediation: "Retry with a valid profile.",
          at: new Date("2026-07-15T12:05:00.000Z").getTime(),
        }),
        new Date("2026-07-15T15:00:00.000Z"),
      ),
    ).toEqual([
      { label: "Recorded", value: expect.stringContaining("Today at") },
      { label: "Duration", value: "Not Recorded" },
      { label: "Initiated by", value: "Desktop app" },
      { label: "Recovery", value: "Retry with a valid profile." },
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
