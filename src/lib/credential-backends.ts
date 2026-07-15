import { BACKEND_UNAVAILABLE_LABEL } from "./display-copy";
import { titleCase } from "./utils";

type CredentialBackendLabelVariant = "default" | "inventory" | "overview";

export function credentialBackendLabel(
  backend: string | null | undefined,
  variant: CredentialBackendLabelVariant = "default",
) {
  const normalized = normalizeCredentialBackend(backend);

  if (!normalized) {
    return BACKEND_UNAVAILABLE_LABEL;
  }

  switch (normalized) {
    case "auto":
      return "Automatic";
    case "file":
      return variant === "inventory" ? "File" : "File-backed";
    case "system-keyring":
      if (variant === "inventory") {
        return "Keychain";
      }
      if (variant === "overview") {
        return "macOS Keychain";
      }
      return "System keyring";
    default:
      return titleCase(normalized.split("_").join(" ").split("-").join(" "));
  }
}

function normalizeCredentialBackend(backend: string | null | undefined) {
  if (!backend) {
    return null;
  }
  if (backend === "system_keyring" || backend === "system-keyring") {
    return "system-keyring";
  }
  return backend;
}
