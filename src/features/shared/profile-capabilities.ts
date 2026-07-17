import { AppBootstrap } from "../../lib/schemas";
import {
  CREDENTIAL_BACKENDS,
  normalizeCredentialBackend as normalizeCredentialBackendValue,
} from "../../lib/credential-backends";
import { isOneOf } from "../../lib/parse-guards";
import {
  canonicalToolId,
  toolDefaultAuthMethods,
  toolDefaultCredentialBackends,
  toolSupportsSystemKeyringCredentials,
} from "../../lib/tool-registry";

const PROFILE_IMPORT_MODE_DEFINITIONS = [
  { id: "from_live" },
  { id: "from_env" },
  { id: "api_key" },
  { id: "oauth" },
] as const;

export type ProfileImportMode = (typeof PROFILE_IMPORT_MODE_DEFINITIONS)[number]["id"];
export const PROFILE_IMPORT_MODES: readonly ProfileImportMode[] =
  PROFILE_IMPORT_MODE_DEFINITIONS.map((mode) => mode.id);

const PROFILE_CREDENTIAL_BACKEND_DEFINITIONS = [
  { id: CREDENTIAL_BACKENDS.auto },
  { id: CREDENTIAL_BACKENDS.systemKeyring },
  { id: CREDENTIAL_BACKENDS.file },
] as const;

export type ProfileCredentialBackend =
  (typeof PROFILE_CREDENTIAL_BACKEND_DEFINITIONS)[number]["id"];
export const PROFILE_CREDENTIAL_BACKENDS: readonly ProfileCredentialBackend[] =
  PROFILE_CREDENTIAL_BACKEND_DEFINITIONS.map((backend) => backend.id);

type ToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export type ExplicitProfileCredentialBackend = Exclude<ProfileCredentialBackend, "auto">;

export const DEFAULT_PROFILE_IMPORT_MODE = PROFILE_IMPORT_MODE_DEFINITIONS[0].id;
export const DEFAULT_PROFILE_CREDENTIAL_BACKEND = PROFILE_CREDENTIAL_BACKENDS[0];

export function supportedProfileImportModes(
  tool: string,
  toolCapabilities: ToolCapabilities,
): ProfileImportMode[] {
  const configured = resolveToolCapability(tool, toolCapabilities)?.auth_methods ?? [];
  const normalized = dedupeNormalizedValues(configured, normalizeImportMode);

  if (normalized.length) {
    return normalized;
  }

  const fallback = dedupeNormalizedValues(toolDefaultAuthMethods(tool), normalizeImportMode);
  return fallback.length ? fallback : [...PROFILE_IMPORT_MODES];
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
  const configured = resolveToolCapability(tool, toolCapabilities)?.credential_backends ?? [];
  const normalized = dedupeNormalizedValues(configured, normalizeCredentialBackend);

  if (normalized.length === 1) {
    return [...normalized];
  }

  if (normalized.length > 1) {
    return [DEFAULT_PROFILE_CREDENTIAL_BACKEND, ...normalized];
  }

  if (!toolSupportsSystemKeyringCredentials(tool)) {
    return ["file"];
  }

  const fallback = dedupeNormalizedValues(
    toolDefaultCredentialBackends(tool),
    normalizeCredentialBackend,
  );
  return fallback.length > 1
    ? [DEFAULT_PROFILE_CREDENTIAL_BACKEND, ...fallback]
    : fallback.length === 1
      ? fallback
      : [...PROFILE_CREDENTIAL_BACKENDS];
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

function dedupeNormalizedValues<InputValue, OutputValue extends string>(
  values: readonly InputValue[],
  normalize: (value: InputValue) => OutputValue | null,
) {
  const normalized: OutputValue[] = [];
  values.forEach((value) => {
    const candidate = normalize(value);
    if (candidate && !normalized.includes(candidate)) {
      normalized.push(candidate);
    }
  });
  return normalized;
}

function resolveToolCapability(
  tool: string,
  toolCapabilities: ToolCapabilities,
) {
  return toolCapabilities[tool] ?? toolCapabilities[canonicalToolId(tool)];
}
