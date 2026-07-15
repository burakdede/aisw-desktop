import { AppBootstrap, AppSnapshot } from "../../lib/schemas";
import { toolSupportsEditableStateModes } from "../../lib/tool-registry";

const EDITABLE_STATE_MODES = new Set(["isolated", "shared"]);

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
