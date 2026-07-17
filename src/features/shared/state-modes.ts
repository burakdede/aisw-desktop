import { AppBootstrap, AppSnapshot } from "../../lib/schemas";
import { isOneOf, nullishToNull } from "../../lib/parse-guards";
import { toolDisplayName } from "../../lib/tool-display";
import { titleCase } from "../../lib/utils";

const EDITABLE_STATE_MODE_DEFINITIONS = [
  {
    id: "isolated",
    description: "Separate config, history, and extensions for this profile.",
  },
  {
    id: "shared",
    description: "Keep the normal tool config and history while switching credentials only.",
  },
] as const;

export type EditableStateMode = (typeof EDITABLE_STATE_MODE_DEFINITIONS)[number]["id"];
export const EDITABLE_STATE_MODES: readonly EditableStateMode[] =
  EDITABLE_STATE_MODE_DEFINITIONS.map((mode) => mode.id);
export type StateModeRequest = EditableStateMode | null;
export type ToolStateModeTarget = {
  tool: string;
  stateMode: StateModeRequest;
};
export const DEFAULT_EDITABLE_STATE_MODE: EditableStateMode = EDITABLE_STATE_MODES[0];

const STATE_MODE_COPY: Record<EditableStateMode, string> = Object.fromEntries(
  EDITABLE_STATE_MODE_DEFINITIONS.map((mode) => [mode.id, mode.description]),
) as Record<EditableStateMode, string>;

export function isEditableStateMode(value: string | null | undefined): value is EditableStateMode {
  return typeof value === "string" && isOneOf(EDITABLE_STATE_MODES, value);
}

export function resolvePreferredEditableStateMode(
  modes: readonly EditableStateMode[],
  preferred: string | null | undefined,
): StateModeRequest {
  if (!modes.length) {
    return null;
  }

  return preferred && isEditableStateMode(preferred) && modes.includes(preferred)
    ? preferred
    : nullishToNull(modes[0]);
}

export function stateModeLabel(mode: string) {
  return titleCase(mode);
}

export function supportedStateModes(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  const capability = toolCapabilities[tool];
  if (!capability) {
    return [...EDITABLE_STATE_MODES];
  }

  const configured = capability.state_modes ?? [];
  if (!configured.length) {
    return [];
  }

  const normalized: EditableStateMode[] = [];
  configured.forEach((mode) => {
    if (isEditableStateMode(mode) && !normalized.includes(mode)) {
      normalized.push(mode);
    }
  });
  return normalized;
}

export function resolveStateModeRequest(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
  preferred: string | null | undefined,
): StateModeRequest {
  const modes = supportedStateModes(tool, toolCapabilities);
  return resolvePreferredEditableStateMode(modes, preferred);
}

export function resolveGlobalStateMode(snapshot: AppSnapshot) {
  const editableStatuses = snapshot.statuses.filter((status) => status.state_mode);
  if (!editableStatuses.length) {
    return DEFAULT_EDITABLE_STATE_MODE;
  }
  return editableStatuses.every((status) => status.state_mode === "shared")
    ? "shared"
    : DEFAULT_EDITABLE_STATE_MODE;
}

export function stateModeDescription(mode: string) {
  return isEditableStateMode(mode)
    ? STATE_MODE_COPY[mode]
    : "Use the runtime-supported state handling for this profile.";
}

export function fixedStateModeDescription(tool: string) {
  return `${toolDisplayName(tool)} keeps authentication and local state together.`;
}
