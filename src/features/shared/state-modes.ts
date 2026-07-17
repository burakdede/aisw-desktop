import { AppBootstrap, AppSnapshot } from "../../lib/schemas";
import { isOneOf } from "../../lib/parse-guards";
import { toolDisplayName } from "../../lib/tool-display";
import { toolSupportsEditableStateModes } from "../../lib/tool-registry";
import { titleCase } from "../../lib/utils";

export const EDITABLE_STATE_MODES = ["isolated", "shared"] as const;
export type EditableStateMode = (typeof EDITABLE_STATE_MODES)[number];
export type StateModeRequest = EditableStateMode | null;
export type ToolStateModeTarget = {
  tool: string;
  stateMode: StateModeRequest;
};
export const DEFAULT_EDITABLE_STATE_MODE: EditableStateMode = EDITABLE_STATE_MODES[0];

const STATE_MODE_COPY: Record<EditableStateMode, string> = {
  isolated: "Separate config, history, and extensions for this profile.",
  shared: "Keep the normal tool config and history while switching credentials only.",
};

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
    : (modes[0] ?? null);
}

export function stateModeLabel(mode: string) {
  return titleCase(mode);
}

export function supportedStateModes(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  if (!toolSupportsEditableStateModes(tool)) {
    return [];
  }

  const configured = toolCapabilities[tool]?.state_modes ?? [];
  const normalized: EditableStateMode[] = [];
  configured.forEach((mode) => {
    if (isEditableStateMode(mode) && !normalized.includes(mode)) {
      normalized.push(mode);
    }
  });

  if (normalized.length) {
    return normalized;
  }

  return [...EDITABLE_STATE_MODES];
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
  const editableStatuses = snapshot.statuses.filter((status) => toolSupportsEditableStateModes(status.tool));
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
