import { describe, expect, it } from "vitest";
import {
  makeRuntimeToolCapabilities,
  makeRuntimeToolCapability,
} from "./runtime-tool-capabilities";

describe("runtime-tool-capabilities", () => {
  it("builds a default runtime tool capability fixture", () => {
    expect(makeRuntimeToolCapability("claude")).toEqual({
      auth_methods: ["oauth", "api_key", "from_env", "from_live"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["file", "system_keyring"],
      fail_closed_keyring_identity: false,
    });
    expect(makeRuntimeToolCapability("codex")).toEqual({
      auth_methods: ["oauth", "api_key", "from_env", "from_live"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["file", "system_keyring"],
      fail_closed_keyring_identity: true,
    });
    expect(makeRuntimeToolCapability("gemini")).toEqual({
      auth_methods: ["oauth", "api_key", "from_env", "from_live"],
      state_modes: ["isolated"],
      credential_backends: ["file"],
      fail_closed_keyring_identity: false,
    });
    expect(makeRuntimeToolCapability("agy")).toEqual({
      auth_methods: ["oauth", "from_live"],
      state_modes: [],
      credential_backends: ["file", "system_keyring"],
      fail_closed_keyring_identity: false,
    });
  });

  it("builds capability maps with per-tool overrides", () => {
    expect(
      makeRuntimeToolCapabilities({
        claude: undefined,
        codex: {
          auth_methods: ["from_live", "oauth"],
          credential_backends: ["file", "system_keyring"],
        },
      }),
    ).toEqual({
      claude: {
        auth_methods: ["oauth", "api_key", "from_env", "from_live"],
        state_modes: ["isolated", "shared"],
        credential_backends: ["file", "system_keyring"],
        fail_closed_keyring_identity: false,
      },
      codex: {
        auth_methods: ["from_live", "oauth"],
        state_modes: ["isolated", "shared"],
        credential_backends: ["file", "system_keyring"],
        fail_closed_keyring_identity: true,
      },
    });
  });
});
