import { asObject, asOptionalString, isOneOf } from "../../lib/parse-guards";
import { APP_NAV_IDS, APP_NAV_LABELS } from "../../lib/app-navigation";
import { DESKTOP_ACTION_COPY } from "../../lib/desktop-action-copy";
import { toolDisplayName } from "../../lib/tool-display";

export const COMMAND_RESULT_SCOPE_TYPES = {
  tool: "tool",
  global: "global",
} as const;

export type CommandResultScopeType =
  (typeof COMMAND_RESULT_SCOPE_TYPES)[keyof typeof COMMAND_RESULT_SCOPE_TYPES];

const COMMAND_RESULT_GLOBAL_DEFINITIONS = [
  {
    key: "switchAll",
    id: "switch-all",
    label: DESKTOP_ACTION_COPY.quickSwitchLabel,
  },
  {
    key: "context",
    id: "context",
    label: APP_NAV_LABELS[APP_NAV_IDS.sets],
  },
  {
    key: "profileSet",
    id: "profile-set",
    label: "Saved set",
  },
  {
    key: "workspace",
    id: "workspace",
    label: "Project rules",
  },
  {
    key: "backup",
    id: "backup",
    label: APP_NAV_LABELS[APP_NAV_IDS.backups],
  },
  {
    key: "settings",
    id: "settings",
    label: APP_NAV_LABELS[APP_NAV_IDS.settings],
  },
  {
    key: "setup",
    id: "setup",
    label: "Setup",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  id: string;
  label: string;
}>;

export const COMMAND_RESULT_GLOBAL_IDS = Object.fromEntries(
  COMMAND_RESULT_GLOBAL_DEFINITIONS.map((definition) => [definition.key, definition.id]),
) as Record<(typeof COMMAND_RESULT_GLOBAL_DEFINITIONS)[number]["key"], (typeof COMMAND_RESULT_GLOBAL_DEFINITIONS)[number]["id"]>;

export type CommandResultGlobalId =
  (typeof COMMAND_RESULT_GLOBAL_IDS)[keyof typeof COMMAND_RESULT_GLOBAL_IDS];

export type ToolCommandResultScope = {
  type: typeof COMMAND_RESULT_SCOPE_TYPES.tool;
  tool: string;
};

export type GlobalCommandResultScope = {
  type: typeof COMMAND_RESULT_SCOPE_TYPES.global;
  id: CommandResultGlobalId;
};

export type CommandResultScope = ToolCommandResultScope | GlobalCommandResultScope;

const COMMAND_RESULT_GLOBAL_ID_VALUES = Object.values(COMMAND_RESULT_GLOBAL_IDS);

export const COMMAND_RESULT_GLOBAL_FALLBACK_LABEL = "App";

export const COMMAND_RESULT_GLOBAL_LABELS: Record<CommandResultGlobalId, string> =
  Object.fromEntries(
    COMMAND_RESULT_GLOBAL_DEFINITIONS.map((definition) => [definition.id, definition.label]),
  ) as Record<CommandResultGlobalId, string>;

export function isCommandResultGlobalId(value: string): value is CommandResultGlobalId {
  return isOneOf(COMMAND_RESULT_GLOBAL_ID_VALUES, value);
}

export function parseCommandResultScope(value: unknown): CommandResultScope | null {
  const record = asObject(value);
  const scopeType = record ? parseCommandResultScopeType(record) : null;
  if (!record || !scopeType) {
    return null;
  }

  if (scopeType === COMMAND_RESULT_SCOPE_TYPES.tool) {
    const tool = commandResultScopeString(record, "tool");
    return tool ? { type: COMMAND_RESULT_SCOPE_TYPES.tool, tool } : null;
  }

  const id = commandResultScopeString(record, "id");
  return id && isCommandResultGlobalId(id)
    ? { type: COMMAND_RESULT_SCOPE_TYPES.global, id }
    : null;
}

export function commandResultGlobalScopeLabel(id: string) {
  return isCommandResultGlobalId(id)
    ? COMMAND_RESULT_GLOBAL_LABELS[id]
    : COMMAND_RESULT_GLOBAL_FALLBACK_LABEL;
}

export function commandResultScopeLabel(scope: CommandResultScope) {
  return scope.type === COMMAND_RESULT_SCOPE_TYPES.tool
    ? toolDisplayName(scope.tool)
    : commandResultGlobalScopeLabel(scope.id);
}

export function commandResultScopeValue(scope: CommandResultScope) {
  return scope.type === COMMAND_RESULT_SCOPE_TYPES.tool ? scope.tool : scope.id;
}

function parseCommandResultScopeType(record: Record<string, unknown>): CommandResultScopeType | null {
  if (record.type === COMMAND_RESULT_SCOPE_TYPES.tool || record.scope === COMMAND_RESULT_SCOPE_TYPES.tool) {
    return COMMAND_RESULT_SCOPE_TYPES.tool;
  }
  if (
    record.type === COMMAND_RESULT_SCOPE_TYPES.global ||
    record.scope === COMMAND_RESULT_SCOPE_TYPES.global
  ) {
    return COMMAND_RESULT_SCOPE_TYPES.global;
  }
  return null;
}

function commandResultScopeString(record: Record<string, unknown>, key: string) {
  return asOptionalString(record[key]);
}
