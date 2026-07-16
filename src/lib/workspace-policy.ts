export const WORKSPACE_GUARD_MODES = ["warn", "strict"] as const;
export type WorkspaceGuardMode = (typeof WORKSPACE_GUARD_MODES)[number];

export const DEFAULT_WORKSPACE_GUARD_MODE: WorkspaceGuardMode =
  WORKSPACE_GUARD_MODES[0];
export const WORKSPACE_NO_CONTEXT = "none";

export function normalizeWorkspaceGuardMode(
  value: unknown,
  fallback: WorkspaceGuardMode = DEFAULT_WORKSPACE_GUARD_MODE,
): WorkspaceGuardMode {
  return typeof value === "string" &&
    WORKSPACE_GUARD_MODES.includes(value as WorkspaceGuardMode)
    ? (value as WorkspaceGuardMode)
    : fallback;
}
