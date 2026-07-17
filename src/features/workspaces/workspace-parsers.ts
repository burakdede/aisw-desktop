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
  asObjectArray,
  isOneOf,
  type UnknownRecord,
} from "../../lib/parse-guards";

export const WORKSPACE_STATUSES = ["match", "mismatch", "drifted", "unknown"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

const WORKSPACE_STATUS_BINDING_KEYS = ["matched_binding", "binding", "match"] as const;
const WORKSPACE_STATUS_CURRENT_CONTEXT_KEYS = ["current_context", "active_context"] as const;
const WORKSPACE_STATUS_EXPECTED_CONTEXT_KEYS = ["expected_context"] as const;
const WORKSPACE_STATUS_CONTEXT_KEYS = ["context"] as const;
const WORKSPACE_BINDING_SCOPE_KEYS = ["scope"] as const;
const WORKSPACE_BINDING_TARGET_KEYS = ["path", "pattern", "target"] as const;
const WORKSPACE_BINDING_COLLECTION_KEYS = ["items", "bindings", "entries"] as const;
const WORKSPACE_BINDING_NO_MATCH_TARGET = "No path or remote match";
const WORKSPACE_BINDING_DEFAULT_TARGET = "default";

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
  return WORKSPACE_BINDING_COLLECTION_KEYS.flatMap((key) => asArray(record?.[key]));
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
  const matchedBinding = firstObjectField(record, WORKSPACE_STATUS_BINDING_KEYS);

  return {
    status: normalizeWorkspaceStatus(record?.status),
    currentContext: asNonEmptyString(
      firstDefinedField(record, WORKSPACE_STATUS_CURRENT_CONTEXT_KEYS),
      WORKSPACE_NO_CONTEXT,
    ),
    expectedContext: asNonEmptyString(
      firstDefinedField(record, WORKSPACE_STATUS_EXPECTED_CONTEXT_KEYS) ??
        firstDefinedField(matchedBinding, WORKSPACE_STATUS_CONTEXT_KEYS) ??
        firstDefinedField(record, WORKSPACE_STATUS_CONTEXT_KEYS),
      WORKSPACE_NO_CONTEXT,
    ),
    scope: asNonEmptyString(
      firstDefinedField(matchedBinding, WORKSPACE_BINDING_SCOPE_KEYS),
      WORKSPACE_NO_CONTEXT,
    ),
    target: asNonEmptyString(
      firstDefinedField(matchedBinding, WORKSPACE_BINDING_TARGET_KEYS),
      WORKSPACE_BINDING_NO_MATCH_TARGET,
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
    bindings: asObjectArray(bindingItems).map((entry) => ({
      context: asNonEmptyString(
        firstDefinedField(entry, WORKSPACE_STATUS_CONTEXT_KEYS),
        WORKSPACE_NO_CONTEXT,
      ),
      scope: asNonEmptyString(firstDefinedField(entry, WORKSPACE_BINDING_SCOPE_KEYS)),
      target: asNonEmptyString(
        firstDefinedField(entry, WORKSPACE_BINDING_TARGET_KEYS),
        WORKSPACE_BINDING_DEFAULT_TARGET,
      ),
    })),
  };
}
