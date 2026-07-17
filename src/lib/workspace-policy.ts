import { normalizeOneOf } from "./parse-guards";

const WORKSPACE_GUARD_MODE_DEFINITIONS = [
  { id: "warn" },
  { id: "strict" },
] as const;

export type WorkspaceGuardMode = (typeof WORKSPACE_GUARD_MODE_DEFINITIONS)[number]["id"];
export const WORKSPACE_GUARD_MODES: readonly WorkspaceGuardMode[] =
  WORKSPACE_GUARD_MODE_DEFINITIONS.map((mode) => mode.id);

export const DEFAULT_WORKSPACE_GUARD_MODE: WorkspaceGuardMode =
  WORKSPACE_GUARD_MODE_DEFINITIONS[0].id;
export const WORKSPACE_NO_CONTEXT = "none";

export function normalizeWorkspaceGuardMode(
  value: unknown,
  fallback: WorkspaceGuardMode = DEFAULT_WORKSPACE_GUARD_MODE,
): WorkspaceGuardMode {
  return normalizeOneOf(WORKSPACE_GUARD_MODES, value, fallback);
}
