import { describe, expect, it } from "vitest";
import { resolveWorkspaceActivationTarget } from "./workspace-activation";
import type { AppSnapshot, DesktopSettings } from "../../lib/schemas";
import { makeToolStatus } from "../../test-support/runtime-tool-statuses";

const snapshot: AppSnapshot = {
  statuses: [
    makeToolStatus("claude", {
      stored_profiles: 1,
      active_profile: "work",
      auth_method: "oauth",
      credential_backend: "system_keyring",
      state_mode: "shared",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
    }),
    makeToolStatus("codex", {
      stored_profiles: 1,
      active_profile: "work",
      auth_method: "api_key",
      credential_backend: "file",
      state_mode: "shared",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
    }),
  ],
  profiles: {
    claude: {
      active: "work",
      profiles: [{ name: "work", auth: "oauth", label: "Work" }],
    },
    codex: {
      active: "work",
      profiles: [{ name: "work", auth: "api_key", label: "Work" }],
    },
  },
  contexts: [
    {
      name: "client-acme",
      profiles: {
        claude: "work",
        codex: "work",
      },
    },
  ],
  workspace_status: null,
  project_bindings: null,
};

describe("resolveWorkspaceActivationTarget", () => {
  it("prefers a saved non-empty profile set over a matching CLI context", () => {
    const settings: DesktopSettings = {
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: {
            claude: "work",
            codex: "work",
            gemini: null,
          },
        },
      ],
    };

    expect(resolveWorkspaceActivationTarget("client-acme", settings, snapshot)).toEqual({
      kind: "profile_set",
      name: "client-acme",
      label: "Client Acme",
    });
  });

  it("prefers the CLI context when the matching saved profile set is empty", () => {
    const settings: DesktopSettings = {
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: {
            claude: null,
            codex: null,
            gemini: null,
          },
        },
      ],
    };

    expect(resolveWorkspaceActivationTarget("client-acme", settings, snapshot)).toEqual({
      kind: "context",
      name: "client-acme",
      stateMode: "shared",
    });
  });

  it("returns null when no matching CLI context or non-empty profile set exists", () => {
    const settings: DesktopSettings = {
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: {
            claude: null,
            codex: null,
            gemini: null,
          },
        },
      ],
    };
    const snapshotWithoutContext: AppSnapshot = {
      ...snapshot,
      contexts: [],
    };

    expect(resolveWorkspaceActivationTarget("client-acme", settings, snapshotWithoutContext)).toBeNull();
  });
});
