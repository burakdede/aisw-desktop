import { APP_NAV_IDS, APP_NAV_LABELS } from "../../lib/app-navigation";
import { DESKTOP_ACTION_COPY } from "../../lib/desktop-action-copy";
import { toolDisplayName } from "../../lib/tool-display";

export const COMMAND_RESULT_SCOPE_TYPES = {
  tool: "tool",
  global: "global",
} as const;

export type CommandResultScopeType =
  (typeof COMMAND_RESULT_SCOPE_TYPES)[keyof typeof COMMAND_RESULT_SCOPE_TYPES];

export const COMMAND_RESULT_GLOBAL_IDS = {
  switchAll: "switch-all",
  context: "context",
  profileSet: "profile-set",
  workspace: "workspace",
  backup: "backup",
  settings: "settings",
  setup: "setup",
} as const;

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

const COMMAND_RESULT_GLOBAL_ID_SET = new Set<CommandResultGlobalId>(
  Object.values(COMMAND_RESULT_GLOBAL_IDS),
);

export const COMMAND_RESULT_GLOBAL_FALLBACK_LABEL = "App";

export const COMMAND_RESULT_GLOBAL_LABELS: Record<CommandResultGlobalId, string> = {
  [COMMAND_RESULT_GLOBAL_IDS.switchAll]: DESKTOP_ACTION_COPY.quickSwitchLabel,
  [COMMAND_RESULT_GLOBAL_IDS.context]: APP_NAV_LABELS[APP_NAV_IDS.sets],
  [COMMAND_RESULT_GLOBAL_IDS.profileSet]: "Saved set",
  [COMMAND_RESULT_GLOBAL_IDS.workspace]: "Project rules",
  [COMMAND_RESULT_GLOBAL_IDS.backup]: APP_NAV_LABELS[APP_NAV_IDS.backups],
  [COMMAND_RESULT_GLOBAL_IDS.settings]: APP_NAV_LABELS[APP_NAV_IDS.settings],
  [COMMAND_RESULT_GLOBAL_IDS.setup]: "Setup",
};

export function isCommandResultGlobalId(value: string): value is CommandResultGlobalId {
  return COMMAND_RESULT_GLOBAL_ID_SET.has(value as CommandResultGlobalId);
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
