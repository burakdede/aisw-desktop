import { AppBootstrap } from "../../lib/schemas";
import {
  CREDENTIAL_BACKENDS,
  normalizeCredentialBackend as normalizeCredentialBackendValue,
} from "../../lib/credential-backends";
import { isOneOf } from "../../lib/parse-guards";
import { toolSupportsSystemKeyringCredentials } from "../../lib/tool-registry";

export const PROFILE_IMPORT_MODES = ["from_live", "from_env", "api_key", "oauth"] as const;
export const PROFILE_CREDENTIAL_BACKENDS = [
  CREDENTIAL_BACKENDS.auto,
  CREDENTIAL_BACKENDS.systemKeyring,
  CREDENTIAL_BACKENDS.file,
] as const;

type ToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export type ProfileImportMode = (typeof PROFILE_IMPORT_MODES)[number];
export type ProfileCredentialBackend = (typeof PROFILE_CREDENTIAL_BACKENDS)[number];
export type ExplicitProfileCredentialBackend = Exclude<ProfileCredentialBackend, "auto">;

export const DEFAULT_PROFILE_IMPORT_MODE = PROFILE_IMPORT_MODES[0];
export const DEFAULT_PROFILE_CREDENTIAL_BACKEND = PROFILE_CREDENTIAL_BACKENDS[0];

export function supportedProfileImportModes(
  tool: string,
  toolCapabilities: ToolCapabilities,
): ProfileImportMode[] {
  const configured = toolCapabilities[tool]?.auth_methods ?? [];
  const normalized = configured
    .map(normalizeImportMode)
    .filter((mode, index, array): mode is ProfileImportMode =>
      Boolean(mode) && array.indexOf(mode) === index,
    );

  if (normalized.length) {
    return normalized;
  }

  return [...PROFILE_IMPORT_MODES];
}

export function supportsProfileImportMode(
  tool: string,
  toolCapabilities: ToolCapabilities,
  mode: ProfileImportMode,
) {
  return supportedProfileImportModes(tool, toolCapabilities).includes(mode);
}

export function preferredProfileImportMode(
  tool: string,
  toolCapabilities: ToolCapabilities,
  preferred: ProfileImportMode,
): ProfileImportMode {
  const supported = supportedProfileImportModes(tool, toolCapabilities);
  if (supported.includes(preferred)) {
    return preferred;
  }
  return supported[0] ?? preferred;
}

export function supportedCredentialBackends(
  tool: string,
  toolCapabilities: ToolCapabilities,
): ProfileCredentialBackend[] {
  const configured = toolCapabilities[tool]?.credential_backends ?? [];
  const normalized = configured
    .map(normalizeCredentialBackend)
    .filter((backend, index, array): backend is ExplicitProfileCredentialBackend =>
      Boolean(backend) && array.indexOf(backend) === index,
    );

  if (normalized.length === 1) {
    return [...normalized];
  }

  if (normalized.length > 1) {
    return [DEFAULT_PROFILE_CREDENTIAL_BACKEND, ...normalized];
  }

  if (!toolSupportsSystemKeyringCredentials(tool)) {
    return ["file"];
  }

  return [...PROFILE_CREDENTIAL_BACKENDS];
}

export function resolveCredentialBackendRequest(backend: ProfileCredentialBackend): string | null {
  return backend === DEFAULT_PROFILE_CREDENTIAL_BACKEND ? null : backend;
}

function normalizeImportMode(mode: string): ProfileImportMode | null {
  return isOneOf(PROFILE_IMPORT_MODES, mode) ? mode : null;
}

function normalizeCredentialBackend(
  backend: string,
): ExplicitProfileCredentialBackend | null {
  const normalized = normalizeCredentialBackendValue(backend);
  if (
    normalized === CREDENTIAL_BACKENDS.systemKeyring ||
    normalized === CREDENTIAL_BACKENDS.file
  ) {
    return normalized;
  }
  return null;
}
