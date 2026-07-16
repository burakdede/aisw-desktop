import type { AppBootstrap } from "../lib/schemas";

export type RuntimeToolCapabilities =
  NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export type RuntimeToolCapability = RuntimeToolCapabilities[string];

export function makeRuntimeToolCapability(
  overrides: Partial<RuntimeToolCapability> = {},
): RuntimeToolCapability {
  return {
    auth_methods: ["oauth"],
    state_modes: ["isolated", "shared"],
    credential_backends: ["system-keyring"],
    fail_closed_keyring_identity: false,
    ...overrides,
  };
}

export function makeRuntimeToolCapabilities(
  entries: Record<string, Partial<RuntimeToolCapability> | undefined>,
): RuntimeToolCapabilities {
  const capabilities: RuntimeToolCapabilities = {};
  Object.entries(entries).forEach(([tool, overrides]) => {
    capabilities[tool] = makeRuntimeToolCapability(overrides);
  });
  return capabilities;
}
