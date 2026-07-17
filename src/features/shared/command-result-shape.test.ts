import { describe, expect, it } from "vitest";
import {
  COMMAND_RESULT_STATUSES,
  isCommandResultStatus,
  parseCommandResultCommand,
  parseStoredCommandResult,
  parseTrayCommandResultEvent,
} from "./command-result-shape";
import { COMMAND_RESULT_GLOBAL_IDS } from "./command-result-scope";
import { DESKTOP_ACTION_RESULT_COPY } from "./desktop-action-result-copy";

describe("command-result-shape", () => {
  it("shares stable command result statuses", () => {
    expect(COMMAND_RESULT_STATUSES).toEqual(["success", "error"]);
    expect(isCommandResultStatus("success")).toBe(true);
    expect(isCommandResultStatus("error")).toBe(true);
    expect(isCommandResultStatus("unknown")).toBe(false);
  });

  it("parses stored command results with optional metadata", () => {
    expect(
      parseStoredCommandResult({
        label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
        status: "error",
        message: "Workspace mismatch.",
        kind: "workspace_mismatch",
        remediation: "Open Sets.",
        command: "aisw use work",
        resultSummary: "Mismatch detected.",
        at: 100,
      }),
    ).toEqual({
      label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
      status: "error",
      message: "Workspace mismatch.",
      kind: "workspace_mismatch",
      remediation: "Open Sets.",
      command: "aisw use work",
      resultSummary: "Mismatch detected.",
      at: 100,
    });

    expect(
      parseStoredCommandResult({
        label: "Missing at",
        status: "success",
        message: "Ok",
      }),
    ).toBeNull();
  });

  it("parses tray command events for tool and global scopes", () => {
    expect(
      parseTrayCommandResultEvent({
        scope: "tool",
        tool: "claude",
        label: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
        status: "success",
        message: "Switched Claude.",
      }),
    ).toEqual({
      scope: "tool",
      tool: "claude",
      label: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
      status: "success",
      message: "Switched Claude.",
      kind: undefined,
      remediation: undefined,
    });

    expect(
      parseTrayCommandResultEvent({
        scope: "global",
        id: COMMAND_RESULT_GLOBAL_IDS.context,
        label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
        status: "error",
        message: "Mismatch.",
        remediation: "Retry.",
      }),
    ).toEqual({
      scope: "global",
      id: COMMAND_RESULT_GLOBAL_IDS.context,
      label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
      status: "error",
      message: "Mismatch.",
      kind: undefined,
      remediation: "Retry.",
    });

    expect(parseTrayCommandResultEvent({ scope: "tool", label: "Broken" })).toBeNull();
    expect(
      parseTrayCommandResultEvent({
        scope: "global",
        id: "unknown",
        label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
        status: "success",
        message: "Ignored.",
      }),
    ).toBeNull();
  });

  it("extracts optional command strings", () => {
    expect(parseCommandResultCommand({ command: "aisw verify" })).toBe("aisw verify");
    expect(parseCommandResultCommand({ command: 42 })).toBeUndefined();
    expect(parseCommandResultCommand(null)).toBeUndefined();
  });
});
