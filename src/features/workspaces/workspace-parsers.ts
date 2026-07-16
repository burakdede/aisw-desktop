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

function normalizeWorkspaceStatus(
  value: unknown,
  fallback: WorkspaceStatus = "unknown",
): WorkspaceStatus {
  return typeof value === "string" &&
    WORKSPACE_STATUSES.includes(value as WorkspaceStatus)
    ? (value as WorkspaceStatus)
    : fallback;
}

export function parseWorkspaceStatus(
  payload: WorkspaceStatusReport | undefined,
): WorkspaceStatusCard {
  const record = pickRecord(payload);
  const matchedBinding =
    asObject(record?.matched_binding) ?? asObject(record?.binding) ?? asObject(record?.match);

  return {
    status: normalizeWorkspaceStatus(record?.status),
    currentContext: asNonEmptyString(
      record?.current_context ?? record?.active_context,
      WORKSPACE_NO_CONTEXT,
    ),
    expectedContext: asNonEmptyString(
      record?.expected_context ?? matchedBinding?.context ?? record?.context,
      WORKSPACE_NO_CONTEXT,
    ),
    scope: asNonEmptyString(matchedBinding?.scope, WORKSPACE_NO_CONTEXT),
    target: asNonEmptyString(
      matchedBinding?.path ?? matchedBinding?.pattern ?? matchedBinding?.target,
      "No path or remote match",
    ),
  };
}

export function parseWorkspaceBindings(
  payload: ProjectBindingsReport | undefined,
): WorkspaceBindingsSummary {
  const record = pickRecord(payload);
  const userBindings = asObject(record?.user_bindings) ?? record;
  const bindingItems = [
    ...asArray(userBindings?.items),
    ...asArray(userBindings?.bindings),
    ...asArray(userBindings?.entries),
  ];

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
        context: asNonEmptyString(entry.context, WORKSPACE_NO_CONTEXT),
        scope: asNonEmptyString(entry.scope),
        target: asNonEmptyString(entry.path ?? entry.pattern ?? entry.target, "default"),
      })),
  };
}
