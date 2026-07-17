import type { ToolStatus } from "../lib/schemas";

export function makeToolStatus(
  tool: ToolStatus["tool"],
  overrides: Partial<ToolStatus> = {},
): ToolStatus {
  return {
    tool,
    binary_found: true,
    stored_profiles: 0,
    active_profile: null,
    auth_method: null,
    credential_backend: null,
    claude_auth_classification: null,
    codex_auth_classification: null,
    antigravity_auth_classification: null,
    state_mode: null,
    active_profile_applied: null,
    credentials_present: null,
    permissions_ok: null,
    token_warning: null,
    warnings: [],
    ...overrides,
  };
}
