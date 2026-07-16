import type { LastCommandResult } from "./lastCommandResult";
import { DesktopCommandError } from "../../lib/tauri";

export const SNAPSHOT_UPDATED_RESULT_SUMMARY = "Snapshot updated successfully.";

export function buildCommandResultSuccess(input: {
  label: string;
  message: string;
  command?: string;
  resultSummary?: string;
}): Omit<LastCommandResult, "at"> {
  return {
    label: input.label,
    status: "success",
    message: input.message,
    command: input.command,
    resultSummary: input.resultSummary,
  };
}

export function buildCommandResultError(
  error: unknown,
  input: {
    label: string;
    fallbackMessage: string;
  },
): Omit<LastCommandResult, "at"> {
  const resolved = error instanceof Error ? error : new Error(input.fallbackMessage);
  return {
    label: input.label,
    status: "error",
    message: resolved.message,
    kind: resolved instanceof DesktopCommandError ? resolved.kind : undefined,
    remediation: resolved instanceof DesktopCommandError ? resolved.remediation : undefined,
  };
}

export function resolveCommandResultCommand(result: unknown) {
  return typeof result === "object" &&
      result !== null &&
      "command" in result &&
      typeof (result as { command?: unknown }).command === "string"
    ? (result as { command: string }).command
    : undefined;
}
