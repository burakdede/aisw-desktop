import { asObject, asOptionalString } from "../../lib/parse-guards";
import {
  isCommandResultGlobalId,
  type CommandResultGlobalId,
} from "./command-result-scope";

export const COMMAND_RESULT_STATUSES = ["success", "error"] as const;

export type CommandResultStatus = (typeof COMMAND_RESULT_STATUSES)[number];

export type ParsedStoredCommandResult = {
  label: string;
  status: CommandResultStatus;
  message: string;
  kind?: string;
  remediation?: string;
  command?: string;
  resultSummary?: string;
  at: number;
};

export type ParsedTrayCommandResultEvent =
  | {
      scope: "tool";
      tool: string;
      label: string;
      status: CommandResultStatus;
      message: string;
      kind?: string;
      remediation?: string;
    }
  | {
      scope: "global";
      id: CommandResultGlobalId;
      label: string;
      status: CommandResultStatus;
      message: string;
      kind?: string;
      remediation?: string;
    };

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

  if (record.scope === "tool") {
    const tool = asOptionalString(record.tool);
    return tool ? { ...base, scope: "tool", tool } : null;
  }

  if (record.scope === "global") {
    const id = asOptionalString(record.id);
    return id && isCommandResultGlobalId(id)
      ? { ...base, scope: "global", id }
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
