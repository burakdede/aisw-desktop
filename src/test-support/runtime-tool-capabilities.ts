import type { AppBootstrap } from "../lib/schemas";
import {
  canonicalToolId,
  toolDefaultAuthMethods,
  toolDefaultCredentialBackends,
  toolDefaultFailClosedKeyringIdentity,
  toolDefaultStateModes,
} from "../lib/tool-registry";

export type RuntimeToolCapabilities =
  NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export type RuntimeToolCapability = RuntimeToolCapabilities[string];

export function makeRuntimeToolCapability(
  tool: string = "claude",
  overrides: Partial<RuntimeToolCapability> = {},
): RuntimeToolCapability {
  const canonical = canonicalToolId(tool);
  return {
    auth_methods: toolDefaultAuthMethods(canonical),
    state_modes: toolDefaultStateModes(canonical),
    credential_backends: toolDefaultCredentialBackends(canonical),
    fail_closed_keyring_identity: toolDefaultFailClosedKeyringIdentity(canonical),
    ...overrides,
  };
}

export function makeRuntimeToolCapabilities(
  entries: Record<string, Partial<RuntimeToolCapability> | undefined>,
): RuntimeToolCapabilities {
  const capabilities: RuntimeToolCapabilities = {};
  Object.entries(entries).forEach(([tool, overrides]) => {
    capabilities[tool] = makeRuntimeToolCapability(tool, overrides);
  });
  return capabilities;
}
