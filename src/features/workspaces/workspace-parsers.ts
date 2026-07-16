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

export interface WorkspaceStatusCard {
  status: string;
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

function pickRecord(payload: Record<string, unknown> | undefined) {
  return asObject(payload?.result) ?? asObject(payload);
}

export function parseWorkspaceStatus(
  payload: Record<string, unknown> | undefined,
): WorkspaceStatusCard {
  const record = pickRecord(payload);
  const matchedBinding =
    asObject(record?.matched_binding) ?? asObject(record?.binding) ?? asObject(record?.match);

  return {
    status: asNonEmptyString(record?.status),
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
  payload: Record<string, unknown> | undefined,
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
