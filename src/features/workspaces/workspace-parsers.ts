import {
  DEFAULT_WORKSPACE_GUARD_MODE,
  WORKSPACE_NO_CONTEXT,
  normalizeWorkspaceGuardMode,
  type WorkspaceGuardMode,
} from "../../lib/workspace-policy";

type UnknownRecord = Record<string, unknown>;

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

function asObject(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "unknown") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
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
    status: asString(record?.status),
    currentContext: asString(
      record?.current_context ?? record?.active_context,
      WORKSPACE_NO_CONTEXT,
    ),
    expectedContext: asString(
      record?.expected_context ?? matchedBinding?.context ?? record?.context,
      WORKSPACE_NO_CONTEXT,
    ),
    scope: asString(matchedBinding?.scope, WORKSPACE_NO_CONTEXT),
    target: asString(
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
    defaultContext: asString(userBindings?.default_context, WORKSPACE_NO_CONTEXT),
    bindings: bindingItems
      .map((entry) => asObject(entry))
      .filter((entry): entry is UnknownRecord => Boolean(entry))
      .map((entry) => ({
        context: asString(entry.context, WORKSPACE_NO_CONTEXT),
        scope: asString(entry.scope),
        target: asString(entry.path ?? entry.pattern ?? entry.target, "default"),
      })),
  };
}
