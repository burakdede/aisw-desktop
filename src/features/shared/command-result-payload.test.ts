import { describe, expect, it } from "vitest";
import { DesktopCommandError } from "../../lib/tauri";
import { DESKTOP_ACTION_RESULT_COPY } from "./desktop-action-result-copy";
import {
  buildCommandResultError,
  buildCommandResultSuccess,
  resolveCommandResultCommand,
  SNAPSHOT_UPDATED_RESULT_SUMMARY,
} from "./command-result-payload";

describe("command-result-payload", () => {
  it("builds success payloads with optional command metadata", () => {
    expect(
      buildCommandResultSuccess({
        label: "Switch profile",
        message: "Switched Claude to Work.",
        command: "aisw use claude work",
        resultSummary: SNAPSHOT_UPDATED_RESULT_SUMMARY,
      }),
    ).toEqual({
      label: "Switch profile",
      status: "success",
      message: "Switched Claude to Work.",
      command: "aisw use claude work",
      resultSummary: SNAPSHOT_UPDATED_RESULT_SUMMARY,
    });
  });

  it("builds error payloads with desktop remediation details when available", () => {
    expect(
      buildCommandResultError(
        new DesktopCommandError("Workspace mismatch.", {
          kind: "workspace_mismatch",
          remediation: "Open Sets.",
        }),
        {
          label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
          fallbackMessage: `${DESKTOP_ACTION_RESULT_COPY.labels.useSet} failed.`,
        },
      ),
    ).toEqual({
      label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
      status: "error",
      message: "Workspace mismatch.",
      kind: "workspace_mismatch",
      remediation: "Open Sets.",
    });

    expect(
      buildCommandResultError(null, {
        label: "Run setup",
        fallbackMessage: "Run setup failed.",
      }),
    ).toEqual({
      label: "Run setup",
      status: "error",
      message: "Run setup failed.",
      kind: undefined,
      remediation: undefined,
    });
  });

  it("extracts command strings from mutation results", () => {
    expect(resolveCommandResultCommand({ command: "aisw verify" })).toBe("aisw verify");
    expect(resolveCommandResultCommand({ command: 42 })).toBeUndefined();
    expect(resolveCommandResultCommand(null)).toBeUndefined();
  });
});
