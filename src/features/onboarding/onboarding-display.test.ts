import { describe, expect, it } from "vitest";
import type { AppBootstrap, AppSnapshot, InitReport } from "../../lib/schemas";
import {
  accountItemTool,
  buildOnboardingHealthItems,
  buildOnboardingRuntimeRows,
  defaultSetupStep,
  onboardingAccountBadge,
  onboardingAccountSummary,
  onboardingSecureStorageStatus,
  onboardingSwitchReadinessStatus,
  readLiveAccounts,
  selectDefaultAccountItem,
  setupStepFooterNote,
  setupStepFooterTitle,
  setupStepSummary,
  shouldShowSetupFlow,
  supportsSecureStorage,
  type OnboardingAccountItem,
} from "./onboarding-display";

function makeBootstrap(overrides: Partial<AppBootstrap> = {}): AppBootstrap {
  return {
    settings: {
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
    },
    runtime_status: {
      resolved_path: "/Applications/AI Switcher.app/Contents/Resources/aisw",
      version: {
        version: "0.3.7",
        cli_api_version: 1,
        json_schema_version: 1,
        progress_schema_version: 1,
      },
      capabilities: {
        features: {},
        tools: {
          claude: {
            auth_methods: ["oauth"],
            state_modes: ["isolated", "shared"],
            credential_backends: ["system-keyring"],
            fail_closed_keyring_identity: false,
          },
        },
      },
      inventory: {
        bundled_path: "/Applications/AI Switcher.app/Contents/Resources/aisw",
        system_path: "/opt/homebrew/bin/aisw",
        configured_path: null,
      },
      compatible: true,
      issues: [],
    },
    snapshot: null,
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
        credential_backend: "system-keyring",
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
        profiles: [{ name: "personal", auth: "oauth", label: "Personal" }],
      },
    },
    contexts: [],
    ...overrides,
  };
}

describe("onboarding-display", () => {
  it("shares setup step copy", () => {
    expect(setupStepSummary("runtime")).toBe(
      "Confirm the included desktop engine, data folder, and secure storage.",
    );
    expect(setupStepFooterTitle("accounts")).toBe("Save at least one reusable account");
    expect(setupStepFooterNote("switch", true)).toBe(
      "Re-apply one saved set once so you know switching works before you start coding.",
    );
    expect(setupStepFooterNote("switch", false)).toBe(
      "You can continue, but you will need one saved set name before the first switch can succeed.",
    );
  });

  it("shares switch readiness copy", () => {
    expect(onboardingSwitchReadinessStatus(true)).toEqual({
      label: "Yes",
      detail: "At least one reusable profile is ready for a first switch.",
    });
    expect(onboardingSwitchReadinessStatus(false)).toEqual({
      label: "Not yet",
      detail: "Save one profile first, then try the first shared switch.",
    });
  });

  it("shares account badge and summary presentation", () => {
    const liveItem: OnboardingAccountItem = {
      key: "claude-live",
      kind: "live",
      account: {
        tool: "claude",
        outcome: "detected",
        auth_method: "oauth",
        matched_profile: "personal",
      },
    };
    const needsProfileItem: OnboardingAccountItem = {
      key: "codex-needs-profile",
      kind: "needs-profile",
      status: {
        ...makeSnapshot().statuses[0],
        tool: "codex",
      },
    };
    const missingItem: OnboardingAccountItem = {
      key: "gemini-missing",
      kind: "missing",
      status: {
        ...makeSnapshot().statuses[0],
        tool: "gemini",
        binary_found: false,
      },
    };

    expect(onboardingAccountBadge(liveItem)).toEqual({ tone: "ok", label: "Ready to import" });
    expect(onboardingAccountBadge(needsProfileItem)).toEqual({
      tone: "soft",
      label: "Needs profile",
    });
    expect(onboardingAccountBadge(missingItem)).toEqual({
      tone: "soft",
      label: "Not installed",
    });

    expect(onboardingAccountSummary(liveItem)).toBe("detected · oauth · matches personal");
    expect(onboardingAccountSummary(needsProfileItem)).toBe("No saved profile yet");
    expect(onboardingAccountSummary(missingItem)).toBe("Not installed yet");
    expect(selectDefaultAccountItem([needsProfileItem, missingItem, liveItem])).toBe(liveItem);
    expect(selectDefaultAccountItem([needsProfileItem, missingItem])).toBe(missingItem);
    expect(accountItemTool(liveItem)).toBe("claude");
    expect(accountItemTool(needsProfileItem)).toBe("codex");
  });

  it("derives live accounts and setup flow visibility from init data", () => {
    const initReport: InitReport = {
      result: {
        live_accounts: [
          {
            tool: "claude",
            outcome: "detected",
            auth_method: "oauth",
            matched_profile: "personal",
          },
        ],
      },
    } as const;

    expect(readLiveAccounts(initReport)).toEqual([
      {
        tool: "claude",
        outcome: "detected",
        auth_method: "oauth",
        matched_profile: "personal",
      },
    ]);

    expect(shouldShowSetupFlow(makeSnapshot(), initReport, false)).toBe(true);
    expect(defaultSetupStep(makeSnapshot(), initReport)).toBe("accounts");
    expect(shouldShowSetupFlow(makeSnapshot(), undefined, true)).toBe(true);
    expect(
      shouldShowSetupFlow(
        makeSnapshot({
          statuses: [{ ...makeSnapshot().statuses[0], binary_found: true }],
        }),
        undefined,
        false,
      ),
    ).toBe(false);
    expect(
      defaultSetupStep(
        makeSnapshot({
          statuses: [{ ...makeSnapshot().statuses[0], binary_found: true }],
        }),
        undefined,
      ),
    ).toBe("runtime");
  });

  it("builds onboarding health rows with normalized doctor labels", () => {
    const bootstrap = makeBootstrap({
      runtime_status: {
        ...makeBootstrap().runtime_status,
        compatible: false,
        issues: ["AISW cannot verify switching engine"],
      },
    });
    const snapshot = makeSnapshot({
      statuses: [
        ...makeSnapshot().statuses,
        {
          ...makeSnapshot().statuses[0],
          tool: "codex",
          binary_found: false,
          active_profile: null,
        },
      ],
    });

    const rows = buildOnboardingHealthItems(bootstrap, snapshot, {
      checks: [
        {
          name: "shell_hook",
          status: "warn",
          detail: "Shell hook is not active in the current shell session.",
        },
        {
          name: "oauth_permission",
          status: "pass",
          detail: "Permission checks passed.",
        },
      ],
    });

    expect(rows[0]).toEqual({
      label: "Desktop engine",
      status: "fail",
      detail: "AI Switch cannot verify desktop engine",
    });
    expect(rows[1]).toEqual({
      label: "Terminal integration",
      status: "warn",
      detail: "Terminal integration is not active in the current shell session.",
    });
    expect(rows[2]).toEqual({
      label: "Local permissions",
      status: "pass",
      detail: "Permission checks passed.",
    });
    expect(rows[3].label).toBe("Claude Code availability");
    expect(rows[4]).toEqual({
      label: "Codex CLI availability",
      status: "fail",
      detail: "Codex CLI binary was not detected on PATH or in live state.",
    });
  });

  it("shares secure storage status and runtime rows", () => {
    const bootstrap = makeBootstrap({
      settings: {
        ...makeBootstrap().settings,
        runtime_kind: "custom",
        aisw_home: "/tmp/aisw",
      },
    });
    const snapshot = makeSnapshot({
      statuses: [
        {
          ...makeSnapshot().statuses[0],
          credential_backend: "file",
        },
      ],
    });
    const capabilities = makeBootstrap().runtime_status.capabilities?.tools ?? {};

    expect(supportsSecureStorage(snapshot, capabilities)).toBe(true);
    expect(onboardingSecureStorageStatus(snapshot, capabilities, "macintel")).toEqual({
      available: true,
      label: "Available",
      detail: "Login Keychain available for local credential storage.",
    });
    expect(
      onboardingSecureStorageStatus(
        {
          ...snapshot,
          statuses: [{ ...snapshot.statuses[0], credential_backend: "file" }],
        },
        {
          claude: {
            ...capabilities.claude,
            credential_backends: [],
          },
        },
        "linux",
      ),
    ).toEqual({
      available: false,
      label: "Not confirmed",
      detail:
        "Secure storage has not been confirmed yet. You can still continue with local file-based profiles.",
    });

    expect(buildOnboardingRuntimeRows(bootstrap, snapshot, capabilities)).toEqual([
      {
        label: "Desktop engine",
        status: "pass",
        detail: "Available, but AI Switch is currently using custom override.",
      },
      {
        label: "Data folder",
        status: "pass",
        detail: "Custom data folder set to /tmp/aisw.",
      },
      {
        label: "Secure storage",
        status: "pass",
        detail: "System keyring available for local credential storage.",
      },
    ]);
  });
});
