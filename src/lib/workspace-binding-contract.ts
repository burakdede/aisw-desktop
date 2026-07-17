import { normalizeOneOf } from "./parse-guards";

const WORKSPACE_BINDING_SCOPE_DEFINITIONS = [
  { id: "default" },
  { id: "path" },
  { id: "git_remote" },
] as const;

export type WorkspaceBindingScope =
  (typeof WORKSPACE_BINDING_SCOPE_DEFINITIONS)[number]["id"];
export const WORKSPACE_BINDING_SCOPES: readonly WorkspaceBindingScope[] =
  WORKSPACE_BINDING_SCOPE_DEFINITIONS.map((scope) => scope.id);

export const DEFAULT_WORKSPACE_BINDING_SCOPE: WorkspaceBindingScope =
  WORKSPACE_BINDING_SCOPE_DEFINITIONS[0].id;

export function normalizeWorkspaceBindingScope(
  value: unknown,
  fallback: WorkspaceBindingScope = DEFAULT_WORKSPACE_BINDING_SCOPE,
): WorkspaceBindingScope {
  return normalizeOneOf(WORKSPACE_BINDING_SCOPES, value, fallback);
}
