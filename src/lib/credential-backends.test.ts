import {
  CREDENTIAL_BACKENDS,
  credentialBackendLabel,
  isSystemKeyringBackend,
  normalizeCredentialBackend,
} from "./credential-backends";

describe("credentialBackendLabel", () => {
  it("formats shared backend labels by screen variant", () => {
    expect(credentialBackendLabel(CREDENTIAL_BACKENDS.auto)).toBe("Automatic");
    expect(credentialBackendLabel(CREDENTIAL_BACKENDS.file)).toBe("File-backed");
    expect(credentialBackendLabel(CREDENTIAL_BACKENDS.file, "inventory")).toBe("File");
    expect(credentialBackendLabel("system_keyring")).toBe("System keyring");
    expect(credentialBackendLabel(CREDENTIAL_BACKENDS.systemKeyring, "inventory")).toBe("Keychain");
    expect(credentialBackendLabel(CREDENTIAL_BACKENDS.systemKeyring, "overview")).toBe("macOS Keychain");
  });

  it("falls back cleanly for unknown or missing values", () => {
    expect(credentialBackendLabel("custom_backend")).toBe("Custom Backend");
    expect(credentialBackendLabel(null)).toBe("Backend Unavailable");
  });

  it("normalizes and classifies keyring backends", () => {
    expect(normalizeCredentialBackend("system_keyring")).toBe(CREDENTIAL_BACKENDS.systemKeyring);
    expect(normalizeCredentialBackend(CREDENTIAL_BACKENDS.systemKeyring)).toBe(
      CREDENTIAL_BACKENDS.systemKeyring,
    );
    expect(normalizeCredentialBackend("file")).toBe(CREDENTIAL_BACKENDS.file);
    expect(isSystemKeyringBackend("system_keyring")).toBe(true);
    expect(isSystemKeyringBackend("file")).toBe(false);
  });
});
