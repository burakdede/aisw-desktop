import type {
  ProjectBindingsReport,
  WorkspaceStatusReport,
} from "../../lib/schemas";
import {
  DEFAULT_WORKSPACE_GUARD_MODE,
  WORKSPACE_NO_CONTEXT,
  normalizeWorkspaceGuardMode,
  type WorkspaceGuardMode,
} from "../../lib/workspace-policy";
import {
  asArray,
  asNonEmptyString,
  asObject,
  isOneOf,
  type UnknownRecord,
} from "../../lib/parse-guards";

export const WORKSPACE_STATUSES = ["match", "mismatch", "drifted", "unknown"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export interface WorkspaceStatusCard {
  status: WorkspaceStatus;
  currentContext: string;
  expectedContext: string;
  scope: string;
  target: string;
}

export interface WorkspaceBindingCard {
  context: string;
  scope: string;
  target: string;
}

export interface WorkspaceBindingsSummary {
  guardMode: WorkspaceGuardMode;
  defaultContext: string;
  bindings: WorkspaceBindingCard[];
}

function pickRecord(payload: UnknownRecord | undefined) {
  return asObject(payload?.result) ?? asObject(payload);
}

function firstObjectField(
  record: UnknownRecord | undefined,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = asObject(record?.[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function firstDefinedField(
  record: UnknownRecord | undefined,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function mergeBindingCollections(record: UnknownRecord | undefined) {
  return [
    ...asArray(record?.items),
    ...asArray(record?.bindings),
    ...asArray(record?.entries),
  ];
}

function normalizeWorkspaceStatus(
  value: unknown,
  fallback: WorkspaceStatus = "unknown",
): WorkspaceStatus {
  return isOneOf(WORKSPACE_STATUSES, value) ? value : fallback;
}

export function parseWorkspaceStatus(
  payload: WorkspaceStatusReport | undefined,
): WorkspaceStatusCard {
  const record = pickRecord(payload);
  const matchedBinding = firstObjectField(record, ["matched_binding", "binding", "match"]);

  return {
    status: normalizeWorkspaceStatus(record?.status),
    currentContext: asNonEmptyString(
      firstDefinedField(record, ["current_context", "active_context"]),
      WORKSPACE_NO_CONTEXT,
    ),
    expectedContext: asNonEmptyString(
      firstDefinedField(record, ["expected_context"]) ??
        firstDefinedField(matchedBinding, ["context"]) ??
        firstDefinedField(record, ["context"]),
      WORKSPACE_NO_CONTEXT,
    ),
    scope: asNonEmptyString(
      firstDefinedField(matchedBinding, ["scope"]),
      WORKSPACE_NO_CONTEXT,
    ),
    target: asNonEmptyString(
      firstDefinedField(matchedBinding, ["path", "pattern", "target"]),
      "No path or remote match",
    ),
  };
}

export function parseWorkspaceBindings(
  payload: ProjectBindingsReport | undefined,
): WorkspaceBindingsSummary {
  const record = pickRecord(payload);
  const userBindings = asObject(record?.user_bindings) ?? record;
  const bindingItems = mergeBindingCollections(userBindings);

  return {
    guardMode: normalizeWorkspaceGuardMode(
      userBindings?.guard_mode,
      DEFAULT_WORKSPACE_GUARD_MODE,
    ),
    defaultContext: asNonEmptyString(userBindings?.default_context, WORKSPACE_NO_CONTEXT),
    bindings: bindingItems
      .map((entry) => asObject(entry))
      .filter((entry): entry is UnknownRecord => Boolean(entry))
      .map((entry) => ({
        context: asNonEmptyString(
          firstDefinedField(entry, ["context"]),
          WORKSPACE_NO_CONTEXT,
        ),
        scope: asNonEmptyString(firstDefinedField(entry, ["scope"])),
        target: asNonEmptyString(
          firstDefinedField(entry, ["path", "pattern", "target"]),
          "default",
        ),
      })),
  };
}
