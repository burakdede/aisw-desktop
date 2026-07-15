import { describe, expect, it } from "vitest";
import type { AppSnapshot, DesktopSettings } from "./schemas";
import {
  activeSetLabel,
  contextDisplayLabel,
  effectiveToolProfileLabel,
  mergeProfileLabel,
  profileDisplayLabel,
  profileSetDisplayLabel,
  sharedProfileEntries,
  toolProfileDisplayLabel,
} from "./profile-display";

function makeSettings(overrides: Partial<DesktopSettings> = {}): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {},
    profile_sets: [],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    statuses: [
      {
        tool: "claude",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "personal",
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        token_warning: null,
        warnings: [],
      },
      {
        tool: "codex",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "personal",
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        token_warning: null,
        warnings: [],
      },
    ],
    profiles: {
      claude: {
        active: "personal",
        profiles: [{ name: "personal", auth: "oauth", label: "Claude Personal" }],
      },
      codex: {
        active: "personal",
        profiles: [{ name: "personal", auth: "oauth", label: null }],
      },
    },
    contexts: [],
    ...overrides,
  };
}

describe("profile-display", () => {
  it("prefers profile label overrides and current labels", () => {
    const settings = makeSettings({
      profile_labels: {
        claude: {
          personal: "Work",
        },
      },
    });
    const snapshot = makeSnapshot();

    expect(profileDisplayLabel(settings, snapshot, "personal")).toBe("Work");
    expect(toolProfileDisplayLabel(settings, snapshot, "claude", "personal")).toBe("Work");
    expect(toolProfileDisplayLabel(makeSettings(), snapshot, "claude", "personal")).toBe(
      "Claude Personal",
    );
    expect(effectiveToolProfileLabel(makeSettings(), "codex", "personal", null)).toBe("Personal");
  });

  it("merges and removes tool label overrides cleanly", () => {
    const settings = makeSettings({
      profile_labels: {
        claude: {
          personal: "Work",
        },
        codex: {
          personal: "Pairing",
        },
      },
    });

    expect(mergeProfileLabel(settings, "claude", "personal", "Primary")).toEqual({
      claude: { personal: "Primary" },
      codex: { personal: "Pairing" },
    });
    expect(mergeProfileLabel(settings, "claude", "personal", null)).toEqual({
      codex: { personal: "Pairing" },
    });
  });

  it("shares set and context labels", () => {
    const settings = makeSettings({
      profile_sets: [
        {
          name: "personal",
          label: "Personal Set",
          profiles: {
            claude: "personal",
            codex: "personal",
          },
        },
      ],
    });
    const snapshot = makeSnapshot();

    expect(sharedProfileEntries(settings, snapshot)).toEqual([
      { name: "personal", label: "Claude Personal" },
    ]);
    expect(activeSetLabel(settings, snapshot)).toBe("Personal Set");
    expect(profileSetDisplayLabel(settings.profile_sets[0])).toBe("Personal Set");
    expect(contextDisplayLabel(settings, "personal")).toBe("Personal Set");
  });
});
