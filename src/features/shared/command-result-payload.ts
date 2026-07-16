import { resolveErrorDetails } from "../../lib/error-details";
import { parseCommandResultCommand } from "./command-result-shape";
import type { CommandResultRecord } from "./command-result-shape";

export const SNAPSHOT_UPDATED_RESULT_SUMMARY = "Snapshot updated successfully.";

export function buildCommandResultSuccess(input: {
  label: string;
  message: string;
  command?: string;
  resultSummary?: string;
}): CommandResultRecord {
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
): CommandResultRecord {
  const resolved = resolveErrorDetails(error, input.fallbackMessage);
  return {
    label: input.label,
    status: "error",
    message: resolved.message,
    kind: resolved.kind,
    remediation: resolved.remediation,
  };
}

export function resolveCommandResultCommand(result: unknown) {
  return parseCommandResultCommand(result);
}
