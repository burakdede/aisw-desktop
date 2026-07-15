import { credentialBackendLabel } from "./credential-backends";

describe("credentialBackendLabel", () => {
  it("formats shared backend labels by screen variant", () => {
    expect(credentialBackendLabel("auto")).toBe("Automatic");
    expect(credentialBackendLabel("file")).toBe("File-backed");
    expect(credentialBackendLabel("file", "inventory")).toBe("File");
    expect(credentialBackendLabel("system_keyring")).toBe("System keyring");
    expect(credentialBackendLabel("system-keyring", "inventory")).toBe("Keychain");
    expect(credentialBackendLabel("system-keyring", "overview")).toBe("macOS Keychain");
  });

  it("falls back cleanly for unknown or missing values", () => {
    expect(credentialBackendLabel("custom_backend")).toBe("Custom Backend");
    expect(credentialBackendLabel(null)).toBe("Backend Unavailable");
  });
});
