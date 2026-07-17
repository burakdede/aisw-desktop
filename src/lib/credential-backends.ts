import { BACKEND_UNAVAILABLE_LABEL } from "./display-copy";
import { humanizeIdentifierLabel } from "./utils";

type CredentialBackendLabelVariant = "default" | "inventory" | "overview";
type KnownCredentialBackend =
  (typeof CREDENTIAL_BACKENDS)[keyof typeof CREDENTIAL_BACKENDS];

export const CREDENTIAL_BACKENDS = {
  auto: "auto",
  file: "file",
  systemKeyring: "system-keyring",
} as const;

const CREDENTIAL_BACKEND_ALIASES = {
  system_keyring: CREDENTIAL_BACKENDS.systemKeyring,
} as const;

const CREDENTIAL_BACKEND_LABELS: Record<
  KnownCredentialBackend,
  {
    default: string;
    inventory?: string;
    overview?: string;
  }
> = {
  [CREDENTIAL_BACKENDS.auto]: {
    default: "Automatic",
  },
  [CREDENTIAL_BACKENDS.file]: {
    default: "File-backed",
    inventory: "File",
  },
  [CREDENTIAL_BACKENDS.systemKeyring]: {
    default: "System keyring",
    inventory: "Keychain",
    overview: "macOS Keychain",
  },
};

const KNOWN_CREDENTIAL_BACKENDS = Object.values(CREDENTIAL_BACKENDS);

export function credentialBackendLabel(
  backend: string | null | undefined,
  variant: CredentialBackendLabelVariant = "default",
) {
  const normalized = normalizeCredentialBackend(backend);

  if (!normalized) {
    return BACKEND_UNAVAILABLE_LABEL;
  }

  if (isKnownCredentialBackend(normalized)) {
    const labels = CREDENTIAL_BACKEND_LABELS[normalized];
    return labels[variant] ?? labels.default;
  }

  return humanizeIdentifierLabel(normalized);
}

export function normalizeCredentialBackend(backend: string | null | undefined) {
  if (!backend) {
    return null;
  }

  return CREDENTIAL_BACKEND_ALIASES[
    backend as keyof typeof CREDENTIAL_BACKEND_ALIASES
  ] ?? backend;
}

export function isSystemKeyringBackend(backend: string | null | undefined) {
  return normalizeCredentialBackend(backend) === CREDENTIAL_BACKENDS.systemKeyring;
}

function isKnownCredentialBackend(value: string): value is KnownCredentialBackend {
  return KNOWN_CREDENTIAL_BACKENDS.includes(value as KnownCredentialBackend);
}
