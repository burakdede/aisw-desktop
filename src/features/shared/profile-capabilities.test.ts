import { describe, expect, it } from "vitest";
import type { AppBootstrap } from "../../lib/schemas";
import { makeRuntimeToolCapabilities } from "../../test-support/runtime-tool-capabilities";
import {
  DEFAULT_PROFILE_CREDENTIAL_BACKEND,
  DEFAULT_PROFILE_IMPORT_MODE,
  PROFILE_CREDENTIAL_BACKENDS,
  PROFILE_IMPORT_MODES,
  preferredProfileImportMode,
  resolveCredentialBackendRequest,
  supportedCredentialBackends,
  supportedProfileImportModes,
} from "./profile-capabilities";

type ToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

describe("profile-capabilities", () => {
  it("shares import-mode and credential-backend defaults", () => {
    expect(PROFILE_IMPORT_MODES).toEqual(["from_live", "from_env", "api_key", "oauth"]);
    expect(DEFAULT_PROFILE_IMPORT_MODE).toBe("from_live");
    expect(PROFILE_CREDENTIAL_BACKENDS).toEqual(["auto", "system-keyring", "file"]);
    expect(DEFAULT_PROFILE_CREDENTIAL_BACKEND).toBe("auto");
  });

  it("normalizes supported import modes and preferred fallbacks", () => {
    const toolCapabilities: ToolCapabilities = makeRuntimeToolCapabilities({
      claude: {
        auth_methods: ["oauth", "from_live", "oauth", "unknown"],
        state_modes: [],
      },
    });

    expect(supportedProfileImportModes("claude", toolCapabilities)).toEqual([
      "oauth",
      "from_live",
    ]);
    expect(preferredProfileImportMode("claude", toolCapabilities, DEFAULT_PROFILE_IMPORT_MODE)).toBe(
      DEFAULT_PROFILE_IMPORT_MODE,
    );
    expect(preferredProfileImportMode("claude", toolCapabilities, "api_key")).toBe("oauth");
  });

  it("normalizes supported credential backends and request values", () => {
    const toolCapabilities: ToolCapabilities = makeRuntimeToolCapabilities({
      claude: {
        auth_methods: [],
        state_modes: [],
        credential_backends: ["system_keyring", "file", "file"],
      },
      gemini: {
        auth_methods: [],
        state_modes: [],
        credential_backends: [],
      },
    });

    expect(supportedCredentialBackends("claude", toolCapabilities)).toEqual([
      DEFAULT_PROFILE_CREDENTIAL_BACKEND,
      "system-keyring",
      "file",
    ]);
    expect(supportedCredentialBackends("gemini", toolCapabilities)).toEqual(["file"]);
    expect(resolveCredentialBackendRequest(DEFAULT_PROFILE_CREDENTIAL_BACKEND)).toBeNull();
    expect(resolveCredentialBackendRequest("file")).toBe("file");
  });
});
