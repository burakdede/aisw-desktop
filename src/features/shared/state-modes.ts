import { AppBootstrap, AppSnapshot } from "../../lib/schemas";
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

const EDITABLE_STATE_MODE_SET = new Set<string>(EDITABLE_STATE_MODES);
const STATE_MODE_COPY: Record<EditableStateMode, string> = {
  isolated: "Separate config, history, and extensions for this profile.",
  shared: "Keep the normal tool config and history while switching credentials only.",
};

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
  const normalized = configured.filter(
    (mode, index) => EDITABLE_STATE_MODE_SET.has(mode) && configured.indexOf(mode) === index,
  );

  if (normalized.length) {
    return normalized as EditableStateMode[];
  }

  return [...EDITABLE_STATE_MODES];
}

export function resolveStateModeRequest(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
  preferred: string | null | undefined,
): StateModeRequest {
  const modes = supportedStateModes(tool, toolCapabilities);
  if (!modes.length) {
    return null;
  }
  if (preferred && modes.includes(preferred as EditableStateMode)) {
    return preferred as EditableStateMode;
  }
  return modes[0] ?? null;
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
  return STATE_MODE_COPY[mode as EditableStateMode]
    ?? "Use the runtime-supported state handling for this profile.";
}

export function fixedStateModeDescription(tool: string) {
  return `${toolDisplayName(tool)} keeps authentication and local state together.`;
}
