import { describe, expect, it } from "vitest";
import type { AppBootstrap, AppSnapshot, InitReport } from "../../lib/schemas";
import { makeRuntimeToolCapabilities } from "../../test-support/runtime-tool-capabilities";
import {
  ONBOARDING_ACCOUNTS_STEP_COPY,
  ONBOARDING_DONE_STEP_COPY,
  ONBOARDING_IMPORT_DIALOG_COPY,
  ONBOARDING_OVERVIEW_COPY,
  ONBOARDING_RUNTIME_NEXT_STEPS,
  ONBOARDING_RUNTIME_STEP_COPY,
  ONBOARDING_SETUP_STEPS,
  ONBOARDING_SETUP_SCREEN_COPY,
  ONBOARDING_STEP_FOOTER_COPY,
  ONBOARDING_SWITCH_STEP_COPY,
  ONBOARDING_TERMINAL_STEP_COPY,
  ONBOARDING_TRUST_ROWS,
  accountItemTool,
  onboardingCompletionState,
  onboardingContinueLabel,
  onboardingDetectedShellSummary,
  onboardingDoneBadgeLabel,
  buildOnboardingInventory,
  buildOnboardingHealthItems,
  buildOnboardingRuntimeRows,
  defaultSetupStep,
  onboardingHealthStatusSymbol,
  onboardingImportDialogAriaLabel,
  onboardingImportedProfileLabel,
  onboardingImportSubmitLabel,
  onboardingLiveAccountImportNote,
  onboardingLiveImportAction,
  onboardingLiveAccountValue,
  onboardingMissingToolHeading,
  onboardingMissingToolNoteParts,
  onboardingMatchedProfileValue,
  onboardingNeedsProfileNote,
  onboardingOverviewBadgeLabel,
  onboardingPrimaryActionLabel,
  onboardingAccountBadge,
  onboardingAccountSummary,
  onboardingRuntimeVersionDetail,
  onboardingSecureStorageStatus,
  onboardingStepProgressLabel,
  onboardingSwitchSubmitLabel,
  onboardingSwitchReadinessStatus,
  readLiveAccounts,
  restoreIncludedEngineActionLabel,
  restoreIncludedEngineErrorMessage,
  resolveOnboardingStepState,
  resolveSelectedOnboardingAccountItem,
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
        tools: makeRuntimeToolCapabilities({
          claude: undefined,
        }),
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
    expect(ONBOARDING_SETUP_STEPS.map((step) => step.value)).toEqual([
      "runtime",
      "accounts",
      "switch",
      "terminal",
      "done",
    ]);
    expect(ONBOARDING_TRUST_ROWS).toEqual([
      "Credentials stay on this computer",
      "No telemetry",
      "No prompt or API traffic proxy",
      "Built-in desktop engine ready",
    ]);
    expect(ONBOARDING_SETUP_SCREEN_COPY.toolbarKicker).toBe("Local-only setup");
    expect(ONBOARDING_SETUP_SCREEN_COPY.closeLabel).toBe("Close setup");
    expect(ONBOARDING_OVERVIEW_COPY.heading).toBe("Switch accounts safely");
    expect(ONBOARDING_OVERVIEW_COPY.installedNowEmpty).toBe("No supported tools detected yet");
    expect(ONBOARDING_OVERVIEW_COPY.readyBadgeLabel).toBe("Ready");
    expect(ONBOARDING_RUNTIME_STEP_COPY.welcomeHeading).toBe("Desktop engine");
    expect(ONBOARDING_RUNTIME_STEP_COPY.settingsButtonLabel).toBe("Engine Settings");
    expect(ONBOARDING_RUNTIME_STEP_COPY.healthFallback).toBe(
      "Run the setup scan to populate desktop engine, storage, and tool health details.",
    );
    expect(ONBOARDING_RUNTIME_NEXT_STEPS).toEqual([
      {
        label: "1. Save your first profile",
        detail:
          "Import the login already open in a supported tool, or add a new profile from the Profiles section.",
      },
      {
        label: "2. Try one switch",
        detail:
          "Re-apply one saved set once so you know switching works before you start coding.",
      },
      {
        label: "3. Add terminal integration later if needed",
        detail:
          "Most people can skip terminal integration unless they need already-open shells to update immediately.",
      },
    ]);
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
    expect(onboardingHealthStatusSymbol("pass")).toBe("✓");
    expect(onboardingHealthStatusSymbol("warn")).toBe("!");
    expect(onboardingHealthStatusSymbol("fail")).toBe("✕");
    expect(ONBOARDING_ACCOUNTS_STEP_COPY.sectionHeading).toBe("Detected tools");
    expect(ONBOARDING_ACCOUNTS_STEP_COPY.importActionLabel).toBe("Import as profile");
    expect(ONBOARDING_ACCOUNTS_STEP_COPY.emptyDetail).toBe(
      "Run the setup scan to detect live Claude, Codex, and Gemini accounts.",
    );
    expect(ONBOARDING_IMPORT_DIALOG_COPY.kicker).toBe("Import current account");
    expect(ONBOARDING_IMPORT_DIALOG_COPY.headingSuffix).toBe("profile");
    expect(ONBOARDING_SWITCH_STEP_COPY.heading).toBe("Try one safe switch");
    expect(ONBOARDING_SWITCH_STEP_COPY.openProfilesLabel).toBe("Open Profiles");
    expect(ONBOARDING_TERMINAL_STEP_COPY.heading).toBe("Terminal integration");
    expect(ONBOARDING_TERMINAL_STEP_COPY.openSetupLabel).toBe("Open terminal setup");
    expect(ONBOARDING_DONE_STEP_COPY.heading).toBe("You're ready");
    expect(ONBOARDING_DONE_STEP_COPY.gridAriaLabel).toBe("Setup completion status");
    expect(ONBOARDING_STEP_FOOTER_COPY.backLabel).toBe("Back");
    expect(ONBOARDING_STEP_FOOTER_COPY.continuePrefix).toBe("Continue to ");
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
        authMethod: "oauth",
        matchedProfile: "personal",
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

  it("builds onboarding inventory and resolves the selected account item", () => {
    const snapshot = makeSnapshot({
      statuses: [
        ...makeSnapshot().statuses,
        {
          ...makeSnapshot().statuses[0],
          tool: "codex",
          binary_found: true,
          active_profile: null,
          stored_profiles: 0,
        },
        {
          ...makeSnapshot().statuses[0],
          tool: "gemini",
          binary_found: false,
          active_profile: null,
          stored_profiles: 0,
        },
      ],
      profiles: {
        ...makeSnapshot().profiles,
        codex: {
          active: null,
          profiles: [],
        },
        gemini: {
          active: null,
          profiles: [],
        },
      },
    });
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

    const inventory = buildOnboardingInventory(snapshot, initReport);

    expect(inventory.liveAccounts).toHaveLength(1);
    expect(inventory.installedToolsNeedingProfile.map((status) => status.tool)).toEqual([
      "codex",
    ]);
    expect(inventory.missingTools.map((status) => status.tool)).toEqual(["gemini"]);
    expect(inventory.installedNow).toEqual(["claude", "codex"]);
    expect(inventory.needsAttentionCount).toBe(3);
    expect(inventory.accountItems.map((item) => item.key)).toEqual([
      "live:claude",
      "needs-profile:codex",
      "missing:gemini",
    ]);
    expect(resolveSelectedOnboardingAccountItem(inventory.accountItems, "missing:gemini")).toEqual(
      inventory.accountItems[2],
    );
    expect(resolveSelectedOnboardingAccountItem(inventory.accountItems, "missing:unknown")).toEqual(
      inventory.accountItems[0],
    );
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
        authMethod: "oauth",
        matchedProfile: "personal",
      },
    ]);

    expect(
      readLiveAccounts({
        result: {
          live_accounts: [
            {
              tool: "claude",
              outcome: "detected",
              auth_method: "oauth",
              matched_profile: null,
            },
            {
              tool: "codex",
              outcome: 123,
            },
            {
              tool: "unknown-tool",
              outcome: "detected",
              auth_method: "oauth",
            },
            "invalid",
          ],
        },
      } as InitReport),
    ).toEqual([
      {
        tool: "claude",
        outcome: "detected",
        authMethod: "oauth",
        matchedProfile: null,
      },
      {
        tool: "codex",
        outcome: undefined,
        authMethod: undefined,
        matchedProfile: undefined,
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

  it("shares step navigation and primary action labels", () => {
    expect(onboardingPrimaryActionLabel(true, undefined)).toBe("Checking This Computer…");
    expect(onboardingPrimaryActionLabel(false, { result: {} } as InitReport)).toBe(
      "Refresh Setup",
    );
    expect(onboardingPrimaryActionLabel(false, undefined)).toBe("Get Started");
    expect(onboardingOverviewBadgeLabel(2)).toBe("2 actions");
    expect(onboardingOverviewBadgeLabel(0)).toBe("Ready");
    expect(onboardingRuntimeVersionDetail("0.3.7")).toBe("Version 0.3.7");
    expect(onboardingRuntimeVersionDetail(null)).toBe("Version unknown");
    expect(onboardingImportedProfileLabel("work laptop")).toBe("Work Laptop account");
    expect(onboardingImportSubmitLabel(true)).toBe("Importing…");
    expect(onboardingImportSubmitLabel(false)).toBe("Import");
    expect(onboardingImportDialogAriaLabel("claude")).toBe("Import Claude Code Profile");
    expect(onboardingLiveAccountImportNote("claude", true)).toBe(
      "Save the current Claude Code login as a reusable profile in a setup sheet.",
    );
    expect(onboardingLiveAccountImportNote("claude", false)).toBe(
      "This release cannot save the current Claude Code login directly. Choose another sign-in method instead.",
    );
    expect(
      onboardingLiveImportAction(
        "claude",
        makeRuntimeToolCapabilities({
          claude: {
            auth_methods: ["from_live", "oauth"],
          },
        }),
      ),
    ).toEqual({
      kind: "import_sheet",
      label: "Import as profile",
    });
    expect(
      onboardingLiveImportAction(
        "claude",
        makeRuntimeToolCapabilities({
          claude: {
            auth_methods: ["oauth"],
          },
        }),
      ),
    ).toEqual({
      kind: "open_profiles",
      label: "Choose sign-in method",
      mode: "oauth",
    });
    expect(onboardingNeedsProfileNote("codex")).toBe(
      "Add one reusable Codex CLI profile so this computer can switch that tool safely later.",
    );
    expect(onboardingMissingToolHeading("gemini")).toBe("Gemini CLI is not installed");
    expect(onboardingMissingToolNoteParts("gemini")).toEqual({
      beforeBinary: "You can finish setup without Gemini CLI. Install the ",
      binary: "gemini",
      afterBinary: " tool later when you want to manage that provider here.",
    });
    expect(onboardingSwitchSubmitLabel(true)).toBe("Switching…");
    expect(onboardingSwitchSubmitLabel(false)).toBe("Switch now");
    expect(onboardingDetectedShellSummary("zsh")).toBe("Detected shell: Zsh");
    expect(onboardingDetectedShellSummary(null)).toBeNull();
    expect(onboardingLiveAccountValue("oauth")).toBe("oauth");
    expect(onboardingLiveAccountValue("")).toBe("unknown");
    expect(onboardingMatchedProfileValue("personal")).toBe("personal");
    expect(onboardingMatchedProfileValue("")).toBe("Not matched yet");
    expect(onboardingDoneBadgeLabel(true)).toBe("Ready to switch");
    expect(onboardingDoneBadgeLabel(false)).toBe("Setup can continue later");
    expect(onboardingStepProgressLabel(0, 5)).toBe("Step 1 of 5");
    expect(onboardingContinueLabel("Terminal")).toBe("Continue to Terminal");
    expect(restoreIncludedEngineActionLabel(true)).toBe("Switching to Included Engine…");
    expect(restoreIncludedEngineActionLabel(false)).toBe("Use Included Engine");
    expect(restoreIncludedEngineErrorMessage(new Error("No bundled engine found."))).toBe(
      "No bundled engine found.",
    );
    expect(restoreIncludedEngineErrorMessage(null)).toBe(
      "Could not switch back to the included desktop engine.",
    );
    expect(resolveOnboardingStepState("runtime")).toEqual({
      steps: ONBOARDING_SETUP_STEPS,
      activeStepIndex: 0,
      previousStep: null,
      nextStep: ONBOARDING_SETUP_STEPS[1],
    });
    expect(resolveOnboardingStepState("done")).toEqual({
      steps: ONBOARDING_SETUP_STEPS,
      activeStepIndex: 4,
      previousStep: ONBOARDING_SETUP_STEPS[3],
      nextStep: null,
    });
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

  it("shares onboarding completion-state copy", () => {
    const activeStatus = makeSnapshot().statuses[0];

    expect(onboardingCompletionState(activeStatus, 1)).toEqual({
      state: "personal",
      detail: "Active on this computer.",
    });
    expect(
      onboardingCompletionState(
        {
          ...activeStatus,
          active_profile: null,
        },
        2,
      ),
    ).toEqual({
      state: "2 saved profiles",
      detail: "Saved locally and ready when needed.",
    });
    expect(
      onboardingCompletionState(
        {
          ...activeStatus,
          active_profile: null,
        },
        0,
      ),
    ).toEqual({
      state: "Not configured",
      detail: "Add a Claude Code profile later from Profiles.",
    });
    expect(
      onboardingCompletionState(
        {
          ...activeStatus,
          tool: "gemini",
          binary_found: false,
          active_profile: null,
        },
        0,
      ),
    ).toEqual({
      state: "Not installed",
      detail: "Optional for now.",
    });
  });
});
