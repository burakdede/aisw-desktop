import { BACKEND_UNAVAILABLE_LABEL } from "./display-copy";
import { humanizeIdentifierLabel } from "./utils";

type CredentialBackendLabelVariant = "default" | "inventory" | "overview";

export const CREDENTIAL_BACKENDS = {
  auto: "auto",
  file: "file",
  systemKeyring: "system-keyring",
} as const;

export function credentialBackendLabel(
  backend: string | null | undefined,
  variant: CredentialBackendLabelVariant = "default",
) {
  const normalized = normalizeCredentialBackend(backend);

  if (!normalized) {
    return BACKEND_UNAVAILABLE_LABEL;
  }

  switch (normalized) {
    case CREDENTIAL_BACKENDS.auto:
      return "Automatic";
    case CREDENTIAL_BACKENDS.file:
      return variant === "inventory" ? "File" : "File-backed";
    case CREDENTIAL_BACKENDS.systemKeyring:
      if (variant === "inventory") {
        return "Keychain";
      }
      if (variant === "overview") {
        return "macOS Keychain";
      }
      return "System keyring";
    default:
      return humanizeIdentifierLabel(normalized);
  }
}

export function normalizeCredentialBackend(backend: string | null | undefined) {
  if (!backend) {
    return null;
  }
  if (backend === "system_keyring" || backend === CREDENTIAL_BACKENDS.systemKeyring) {
    return CREDENTIAL_BACKENDS.systemKeyring;
  }
  return backend;
}

export function isSystemKeyringBackend(backend: string | null | undefined) {
  return normalizeCredentialBackend(backend) === CREDENTIAL_BACKENDS.systemKeyring;
}
