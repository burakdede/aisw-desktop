import { AppBootstrap, AppSnapshot } from "../../lib/schemas";
import { toolDisplayName } from "../../lib/tool-display";
import { toolSupportsEditableStateModes } from "../../lib/tool-registry";

const EDITABLE_STATE_MODES = new Set(["isolated", "shared"]);
const STATE_MODE_COPY: Record<string, string> = {
  isolated: "Separate config, history, and extensions for this profile.",
  shared: "Keep the normal tool config and history while switching credentials only.",
};

export function supportedStateModes(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  if (!toolSupportsEditableStateModes(tool)) {
    return [];
  }

  const configured = toolCapabilities[tool]?.state_modes ?? [];
  const normalized = configured.filter(
    (mode, index) => EDITABLE_STATE_MODES.has(mode) && configured.indexOf(mode) === index,
  );

  if (normalized.length) {
    return normalized;
  }

  return ["isolated", "shared"];
}

export function resolveStateModeRequest(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
  preferred: string | null | undefined,
) {
  const modes = supportedStateModes(tool, toolCapabilities);
  if (!modes.length) {
    return null;
  }
  if (preferred && modes.includes(preferred)) {
    return preferred;
  }
  return modes[0] ?? null;
}

export function resolveGlobalStateMode(snapshot: AppSnapshot) {
  const editableStatuses = snapshot.statuses.filter((status) => toolSupportsEditableStateModes(status.tool));
  if (!editableStatuses.length) {
    return "isolated";
  }
  return editableStatuses.every((status) => status.state_mode === "shared")
    ? "shared"
    : "isolated";
}

export function stateModeDescription(mode: string) {
  return STATE_MODE_COPY[mode] ?? "Use the runtime-supported state handling for this profile.";
}

export function fixedStateModeDescription(tool: string) {
  return `${toolDisplayName(tool)} keeps authentication and local state together.`;
}
