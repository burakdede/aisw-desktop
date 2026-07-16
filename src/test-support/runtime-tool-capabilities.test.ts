import { describe, expect, it } from "vitest";
import {
  makeRuntimeToolCapabilities,
  makeRuntimeToolCapability,
} from "./runtime-tool-capabilities";

describe("runtime-tool-capabilities", () => {
  it("builds a default runtime tool capability fixture", () => {
    expect(makeRuntimeToolCapability()).toEqual({
      auth_methods: ["oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring"],
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
        auth_methods: ["oauth"],
        state_modes: ["isolated", "shared"],
        credential_backends: ["system-keyring"],
        fail_closed_keyring_identity: false,
      },
      codex: {
        auth_methods: ["from_live", "oauth"],
        state_modes: ["isolated", "shared"],
        credential_backends: ["file", "system_keyring"],
        fail_closed_keyring_identity: false,
      },
    });
  });
});
