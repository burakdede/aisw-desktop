import { asObject, asOptionalString } from "../../lib/parse-guards";
import type { ErrorMetadata } from "../../lib/error-details";
import {
  COMMAND_RESULT_SCOPE_TYPES,
  isCommandResultGlobalId,
  type CommandResultGlobalId,
} from "./command-result-scope";

export const COMMAND_RESULT_STATUSES = ["success", "error"] as const;

export type CommandResultStatus = (typeof COMMAND_RESULT_STATUSES)[number];

export type CommandResultBase = {
  label: string;
  status: CommandResultStatus;
  message: string;
} & ErrorMetadata;

export type CommandResultSummary = Pick<
  CommandResultBase,
  "status" | "message" | "remediation"
>;

export type CommandResultMetadata = {
  command?: string;
  resultSummary?: string;
};

export type CommandResultRecord = CommandResultBase & CommandResultMetadata;

export type ParsedStoredCommandResult = CommandResultRecord & {
  at: number;
};

export type ParsedTrayCommandResultEvent =
  | {
      scope: typeof COMMAND_RESULT_SCOPE_TYPES.tool;
      tool: string;
    } & CommandResultBase
  | {
      scope: typeof COMMAND_RESULT_SCOPE_TYPES.global;
      id: CommandResultGlobalId;
    } & CommandResultBase;

export function parseStoredCommandResult(
  value: unknown,
): ParsedStoredCommandResult | null {
  const base = parseCommandResultBase(value);
  const record = asObject(value);
  if (!base || !record || typeof record.at !== "number") {
    return null;
  }

  return {
    ...base,
    at: record.at,
  };
}

export function parseTrayCommandResultEvent(
  value: unknown,
): ParsedTrayCommandResultEvent | null {
  const base = parseCommandResultBase(value);
  const record = asObject(value);
  if (!base || !record) {
    return null;
  }

  if (record.scope === COMMAND_RESULT_SCOPE_TYPES.tool) {
    const tool = asOptionalString(record.tool);
    return tool ? { ...base, scope: COMMAND_RESULT_SCOPE_TYPES.tool, tool } : null;
  }

  if (record.scope === COMMAND_RESULT_SCOPE_TYPES.global) {
    const id = asOptionalString(record.id);
    return id && isCommandResultGlobalId(id)
      ? { ...base, scope: COMMAND_RESULT_SCOPE_TYPES.global, id }
      : null;
  }

  return null;
}

export function parseCommandResultCommand(value: unknown) {
  return asOptionalString(asObject(value)?.command);
}

function parseCommandResultBase(value: unknown) {
  const record = asObject(value);
  if (!record) {
    return null;
  }

  const label = asOptionalString(record.label);
  const message = asOptionalString(record.message);
  const status = parseCommandResultStatus(record.status);
  if (!label || !message || !status) {
    return null;
  }

  return {
    label,
    status,
    message,
    kind: asOptionalString(record.kind),
    remediation: asOptionalString(record.remediation),
    command: asOptionalString(record.command),
    resultSummary: asOptionalString(record.resultSummary),
  };
}

function parseCommandResultStatus(value: unknown): CommandResultStatus | null {
  return value === "success" || value === "error" ? value : null;
}
