export const WORKSPACE_BINDING_SCOPES = [
  "default",
  "path",
  "git_remote",
] as const;

export type WorkspaceBindingScope = (typeof WORKSPACE_BINDING_SCOPES)[number];

export const DEFAULT_WORKSPACE_BINDING_SCOPE: WorkspaceBindingScope =
  WORKSPACE_BINDING_SCOPES[0];

export function normalizeWorkspaceBindingScope(
  value: unknown,
  fallback: WorkspaceBindingScope = DEFAULT_WORKSPACE_BINDING_SCOPE,
): WorkspaceBindingScope {
  return typeof value === "string" &&
    WORKSPACE_BINDING_SCOPES.includes(value as WorkspaceBindingScope)
    ? (value as WorkspaceBindingScope)
    : fallback;
}
