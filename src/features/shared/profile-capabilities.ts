import { AppBootstrap } from "../../lib/schemas";

const PROFILE_IMPORT_MODES = ["from_live", "from_env", "api_key", "oauth"] as const;
const PROFILE_CREDENTIAL_BACKENDS = ["auto", "system-keyring", "file"] as const;

type ToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export type ProfileImportMode = (typeof PROFILE_IMPORT_MODES)[number];
export type ProfileCredentialBackend = (typeof PROFILE_CREDENTIAL_BACKENDS)[number];

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

export function supportedCredentialBackends(
  tool: string,
  toolCapabilities: ToolCapabilities,
): ProfileCredentialBackend[] {
  const configured = toolCapabilities[tool]?.credential_backends ?? [];
  const normalized = configured
    .map(normalizeCredentialBackend)
    .filter((backend, index, array): backend is Exclude<ProfileCredentialBackend, "auto"> =>
      Boolean(backend) && array.indexOf(backend) === index,
    );

  if (normalized.length === 1) {
    return [...normalized];
  }

  if (normalized.length > 1) {
    return ["auto", ...normalized];
  }

  if (tool === "gemini") {
    return ["file"];
  }

  return ["auto", "system-keyring", "file"];
}

export function resolveCredentialBackendRequest(backend: ProfileCredentialBackend): string | null {
  return backend === "auto" ? null : backend;
}

function normalizeImportMode(mode: string): ProfileImportMode | null {
  if (PROFILE_IMPORT_MODES.includes(mode as ProfileImportMode)) {
    return mode as ProfileImportMode;
  }
  return null;
}

function normalizeCredentialBackend(
  backend: string,
): Exclude<ProfileCredentialBackend, "auto"> | null {
  if (backend === "system_keyring" || backend === "system-keyring") {
    return "system-keyring";
  }
  if (backend === "file") {
    return "file";
  }
  return null;
}
