import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProfile,
  addProfileOAuth,
  useAllProfiles,
  useContext,
  useProfile,
} from "./client";

const { invokeDesktopMock } = vi.hoisted(() => ({
  invokeDesktopMock: vi.fn(),
}));

vi.mock("./tauri", () => ({
  invokeDesktop: invokeDesktopMock,
}));

function makeMutationResponse() {
  return {
    command: "test-command",
    snapshot: {
      statuses: [],
      profiles: {},
      contexts: [],
    },
  };
}

describe("client", () => {
  beforeEach(() => {
    invokeDesktopMock.mockReset();
    invokeDesktopMock.mockResolvedValue(makeMutationResponse());
  });

  it("shares profile mutation request shaping for stored and OAuth profile creation", async () => {
    await addProfile({
      tool: "claude",
      profile: "work",
      label: undefined,
      stateMode: undefined,
      credentialBackend: undefined,
      importMode: { kind: "from_live" },
    });

    expect(invokeDesktopMock).toHaveBeenCalledWith("add_profile", {
      request: {
        tool: "claude",
        profile: "work",
        label: null,
        state_mode: null,
        credential_backend: null,
        import_mode: { kind: "from_live" },
      },
    });

    await addProfileOAuth({
      tool: "codex",
      profile: "pairing",
      label: "Pairing",
      stateMode: "shared",
      credentialBackend: "file",
    });

    expect(invokeDesktopMock).toHaveBeenLastCalledWith("add_profile_oauth", {
      request: {
        tool: "codex",
        profile: "pairing",
        label: "Pairing",
        state_mode: "shared",
        credential_backend: "file",
      },
    });
  });

  it("shares state-mode request shaping across profile, global, and context activation", async () => {
    await useProfile({
      tool: "claude",
      profile: "work",
    });
    expect(invokeDesktopMock).toHaveBeenCalledWith("use_profile", {
      request: {
        tool: "claude",
        profile: "work",
        state_mode: null,
      },
    });

    await useAllProfiles({
      profile: "release",
      stateMode: "isolated",
    });
    expect(invokeDesktopMock).toHaveBeenCalledWith("use_all_profiles", {
      request: {
        profile: "release",
        state_mode: "isolated",
      },
    });

    await useContext({
      context: "acme-app",
    });
    expect(invokeDesktopMock).toHaveBeenLastCalledWith("use_context", {
      request: {
        context: "acme-app",
        state_mode: null,
      },
    });
  });
});
