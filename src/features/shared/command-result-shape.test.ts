import { describe, expect, it } from "vitest";
import {
  COMMAND_RESULT_STATUSES,
  parseCommandResultCommand,
  parseStoredCommandResult,
  parseTrayCommandResultEvent,
} from "./command-result-shape";

describe("command-result-shape", () => {
  it("shares stable command result statuses", () => {
    expect(COMMAND_RESULT_STATUSES).toEqual(["success", "error"]);
  });

  it("parses stored command results with optional metadata", () => {
    expect(
      parseStoredCommandResult({
        label: "Use set",
        status: "error",
        message: "Workspace mismatch.",
        kind: "workspace_mismatch",
        remediation: "Open Sets.",
        command: "aisw use work",
        resultSummary: "Mismatch detected.",
        at: 100,
      }),
    ).toEqual({
      label: "Use set",
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
        label: "Use profile",
        status: "success",
        message: "Switched Claude.",
      }),
    ).toEqual({
      scope: "tool",
      tool: "claude",
      label: "Use profile",
      status: "success",
      message: "Switched Claude.",
      kind: undefined,
      remediation: undefined,
    });

    expect(
      parseTrayCommandResultEvent({
        scope: "global",
        id: "context",
        label: "Use set",
        status: "error",
        message: "Mismatch.",
        remediation: "Retry.",
      }),
    ).toEqual({
      scope: "global",
      id: "context",
      label: "Use set",
      status: "error",
      message: "Mismatch.",
      kind: undefined,
      remediation: "Retry.",
    });

    expect(parseTrayCommandResultEvent({ scope: "tool", label: "Broken" })).toBeNull();
  });

  it("extracts optional command strings", () => {
    expect(parseCommandResultCommand({ command: "aisw verify" })).toBe("aisw verify");
    expect(parseCommandResultCommand({ command: 42 })).toBeUndefined();
    expect(parseCommandResultCommand(null)).toBeUndefined();
  });
});
