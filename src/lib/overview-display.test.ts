import { describe, expect, it } from "vitest";
import type { AppSnapshot, DesktopSettings, ToolStatus } from "./schemas";
import {
  CHOOSE_SET_LABEL,
  OPEN_SETS_LABEL,
  USE_EXPECTED_SET_LABEL,
} from "./sets-display";
import {
  buildOverviewInspectorNotices,
  buildOverviewStateSummary,
  buildOverviewInspectorPresentation,
  OVERVIEW_CURRENT_SET_LABEL,
  OVERVIEW_EMPTY_SELECTION_COPY,
  overviewInspectorActionDisabled,
  overviewInspectorEmptyHeading,
  overviewAuthMethodLabel,
  overviewDiagnosticWarning,
  overviewHeadline,
  overviewLastResultMessage,
  overviewLiveMismatchNotice,
  overviewMetaLabel,
  OVERVIEW_MORE_ACTIONS_LABEL,
  OVERVIEW_NO_TOOL_SELECTED_HEADING,
  OVERVIEW_PANEL_COPY,
  overviewRecentSummary,
  overviewSelectedStateMode,
  overviewSetButtonLabel,
  overviewSelectProfileLabel,
  overviewStateModeLabel,
  overviewToolCountLabel,
  overviewToolInspectorLabel,
  overviewToolListProfileLabel,
  overviewMissingBinaryMessage,
  overviewStateModeCopy,
  overviewTokenWarning,
  overviewWorkspaceActionLabel,
  resolveOverviewActionProfileLabel,
  resolveOverviewSelectedProfile,
  resolveOverviewSelectedTool,
  resolveOverviewStateMode,
  resolveOverallOverviewState,
} from "./overview-display";

function makeStatus(overrides: Partial<ToolStatus> = {}): ToolStatus {
  return {
    tool: "claude",
    binary_found: true,
    stored_profiles: 1,
    active_profile: "personal",
    active_profile_applied: true,
    auth_method: "oauth",
    state_mode: "isolated",
    credential_backend: "file",
    warnings: [],
    token_warning: null,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    statuses: [makeStatus()],
    profiles: {
      claude: {
        active: "personal",
        profiles: [
          { name: "personal", auth: "oauth", label: "Personal" },
          { name: "work", auth: "oauth", label: "Work" },
        ],
      },
    },
    contexts: [],
    workspace_status: null,
    project_bindings: null,
    ...overrides,
  };
}

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

describe("overview-display", () => {
  it("shares overall overview health presentation", () => {
    expect(buildOverviewStateSummary(["blocked", "ready"])).toMatchObject({
      overallState: "blocked",
      headline: "1 tool blocked",
      metaLabel: "Fix blocked tools first",
      counts: {
        ready: 1,
        needs_attention: 0,
        blocked: 1,
        not_configured: 0,
        not_verified: 0,
      },
    });
    expect(resolveOverallOverviewState(["blocked", "ready"])).toBe("blocked");
    expect(resolveOverallOverviewState(["needs_attention", "ready"])).toBe("needs_attention");
    expect(resolveOverallOverviewState(["not_configured", "not_configured"])).toBe(
      "not_configured",
    );
    expect(resolveOverallOverviewState(["ready", "not_verified"])).toBe("not_verified");

    expect(overviewHeadline(["blocked", "ready"])).toBe("1 tool blocked");
    expect(overviewHeadline(["needs_attention", "needs_attention"])).toBe(
      "2 tools need attention",
    );
    expect(overviewHeadline(["not_verified"])).toBe("1 tool still needs verification");
    expect(overviewMetaLabel(["blocked", "ready"])).toBe("Fix blocked tools first");
    expect(overviewMetaLabel(["needs_attention"])).toBe("Review mismatches before coding");
    expect(overviewMetaLabel(["not_verified"])).toBe("Verification pending");
    expect(overviewMetaLabel(["ready"])).toBe("Ready to switch");
    expect(overviewMetaLabel([])).toBe("No profiles configured");
  });

  it("shares workspace and state-mode copy", () => {
    expect(OVERVIEW_CURRENT_SET_LABEL).toBe("Current set:");
    expect(OVERVIEW_EMPTY_SELECTION_COPY).toBe(
      "Choose a tool to inspect its active profile and switching state.",
    );
    expect(OVERVIEW_NO_TOOL_SELECTED_HEADING).toBe("No tool selected");
    expect(OVERVIEW_MORE_ACTIONS_LABEL).toBe("More profile actions");
    expect(OVERVIEW_PANEL_COPY.currentSetFallback).toBe("None");
    expect(OVERVIEW_PANEL_COPY.noToolsHeading).toBe("No tools detected");
    expect(OVERVIEW_PANEL_COPY.footerActionLabel).toBe("View Activity");
    expect(OVERVIEW_PANEL_COPY.actionsMenuAriaLabel).toBe("Overview actions");
    expect(OVERVIEW_PANEL_COPY.facts.authentication).toBe("Authentication");
    expect(overviewToolCountLabel(3)).toBe("3 total");
    expect(overviewToolInspectorLabel("claude")).toBe("Inspect Claude");
    expect(overviewSelectProfileLabel("claude")).toBe("Switch claude profile");
    expect(overviewStateModeLabel("system_keyring")).toBe("System Keyring");
    expect(overviewMissingBinaryMessage("Claude Code")).toBe(
      "Claude Code is not installed on this Mac.",
    );
    expect(overviewLiveMismatchNotice("Claude Code", "Personal")).toEqual({
      summary: "Live credentials do not match Personal.",
      detail: "Claude Code appears to have been signed into outside AI Switch.",
    });
    expect(overviewWorkspaceActionLabel(true)).toBe(USE_EXPECTED_SET_LABEL);
    expect(overviewWorkspaceActionLabel(false)).toBe(OPEN_SETS_LABEL);
    expect(overviewSetButtonLabel(true)).toBe(OPEN_SETS_LABEL);
    expect(overviewSetButtonLabel(false)).toBe(CHOOSE_SET_LABEL);
    expect(overviewInspectorEmptyHeading(true, "Claude Code")).toBe("Claude Code");
    expect(overviewInspectorEmptyHeading(false, "Claude Code")).toBe(
      OVERVIEW_NO_TOOL_SELECTED_HEADING,
    );
    expect(resolveOverviewSelectedTool("claude", makeSnapshot().statuses)).toBe("claude");
    expect(resolveOverviewSelectedTool("missing", makeSnapshot().statuses)).toBe("claude");
    expect(resolveOverviewSelectedTool("claude", [])).toBe("");
    expect(resolveOverviewStateMode("shared", ["isolated", "shared"])).toBe("shared");
    expect(resolveOverviewStateMode("unknown", ["isolated", "shared"])).toBe("isolated");
    expect(overviewSelectedStateMode(["isolated", "shared"], "shared")).toBe("shared");
    expect(overviewSelectedStateMode([], "isolated")).toBeNull();
    expect(resolveOverviewActionProfileLabel("Work", "Personal", "personal")).toBe("Work");
    expect(resolveOverviewActionProfileLabel(null, "Personal", "personal")).toBe("Personal");
    expect(resolveOverviewActionProfileLabel(null, null, "personal")).toBe("personal");
    expect(resolveOverviewActionProfileLabel("   ", "Personal", "personal")).toBe("Personal");
    expect(resolveOverviewActionProfileLabel(null, null, null)).toBe("profile");
    expect(resolveOverviewSelectedProfile("work", makeSnapshot().profiles.claude.profiles, "personal")).toBe("work");
    expect(resolveOverviewSelectedProfile("missing", makeSnapshot().profiles.claude.profiles, "personal")).toBe("personal");
    expect(resolveOverviewSelectedProfile("missing", makeSnapshot().profiles.claude.profiles, "unknown")).toBe("personal");
    expect(
      overviewToolListProfileLabel(makeStatus(), makeSettings(), makeSnapshot()),
    ).toBe("Personal");
    expect(
      overviewToolListProfileLabel(
        makeStatus({ active_profile: null }),
        makeSettings(),
        makeSnapshot(),
      ),
    ).toBe("No saved profile yet");
    expect(overviewStateModeCopy(["isolated", "shared"], "shared", "claude")).toBe(
      "Keep the normal tool config and history while switching credentials only.",
    );
    expect(overviewStateModeCopy([], "isolated", "gemini")).toBe(
      "Gemini CLI keeps authentication and local state together.",
    );
  });

  it("shares recent action summaries and warnings", () => {
    expect(
      overviewRecentSummary({
        bulkResult: {
          status: "success",
          message: "Switched set.",
          remediation: "Verify live state.",
        },
      }),
    ).toBe("Last set result: Switched set. Remediation: Verify live state.");
    expect(
      overviewRecentSummary({
        contextResult: {
          status: "error",
          message: "AISW cannot load CLI context.",
          remediation: "Open Sets.",
        },
      }),
    ).toBe("Last set result: AI Switch cannot load set. Remediation: Open Sets.");
    expect(overviewRecentSummary({})).toBe(
      "No recent set or workspace changes are recorded in this session.",
    );
    expect(
      overviewLastResultMessage({
        message: "Switched Claude to Personal.",
      }),
    ).toBe("Last result: Switched Claude to Personal.");
    expect(
      overviewLastResultMessage({
        message: "profile work no longer exists",
        remediation: "Refresh profile state.",
      }),
    ).toBe(
      "Last result: profile work no longer exists Remediation: Refresh profile state.",
    );

    expect(
      overviewTokenWarning(
        makeStatus({
          token_warning: {
            summary: "Session expires soon",
            expires_in_days: 2,
          },
        }),
      ),
    ).toBe("Token warning: Session expires soon Expires in 2 days.");
    expect(overviewTokenWarning(makeStatus())).toBe("Token state needs attention.");

    expect(
      overviewDiagnosticWarning({
        message: "Workspace mismatch",
        remediation: "Open Sets",
      }),
    ).toBe("Warning: Workspace mismatch Remediation: Open Sets");
    expect(overviewAuthMethodLabel("api_key")).toBe("API Key");
    expect(overviewAuthMethodLabel(null)).toBe("Not configured");
    expect(overviewInspectorActionDisabled("open_profile", true, true)).toBe(false);
    expect(overviewInspectorActionDisabled("refresh", false, true)).toBe(true);
    expect(overviewInspectorActionDisabled("switch", true, false)).toBe(true);
  });

  it("builds shared inspector notices for mismatch, warnings, and command results", () => {
    expect(
      buildOverviewInspectorNotices({
        activeProfileLabel: "Personal",
        hasProfiles: true,
        lastResult: {
          label: "Claude",
          status: "success",
          message: "Switched Claude to Personal.",
        },
        status: makeStatus({
          active_profile_applied: false,
          token_warning: {
            summary: "Session expires soon",
            expires_in_days: 2,
          },
          warnings: [{ message: "Workspace mismatch", remediation: "Open Sets" }],
        }),
        toolName: "Claude Code",
      }),
    ).toEqual([
      {
        tone: "warn",
        symbol: "▲",
        summary: "Live credentials do not match Personal.",
        detail: "Claude Code appears to have been signed into outside AI Switch.",
      },
      {
        tone: "warn",
        symbol: "▲",
        summary: "Token warning: Session expires soon Expires in 2 days.",
      },
      {
        tone: "warn",
        symbol: "▲",
        summary: "Warning: Workspace mismatch Remediation: Open Sets",
      },
      {
        tone: "ok",
        symbol: "●",
        summary: "Last result: Switched Claude to Personal.",
      },
    ]);

    expect(
      buildOverviewInspectorNotices({
        activeProfileLabel: null,
        hasProfiles: false,
        lastResult: {
          label: "Claude",
          status: "error",
          message: "Switch failed.",
        },
        status: makeStatus({
          active_profile: null,
          active_profile_applied: false,
          token_warning: {
            summary: "Ignored without profiles",
          },
          warnings: [{ message: "Ignored without profiles" }],
        }),
        toolName: "Claude Code",
      }),
    ).toEqual([
      {
        tone: "warn",
        symbol: "▲",
        summary: "Live credentials do not match the saved profile.",
        detail: "Claude Code appears to have been signed into outside AI Switch.",
      },
    ]);
  });

  it("builds overview inspector actions for alternate profile switching", () => {
    const snapshot = makeSnapshot();
    const presentation = buildOverviewInspectorPresentation({
      profiles: snapshot.profiles.claude.profiles,
      selectedProfile: "work",
      settings: makeSettings(),
      snapshot,
      stateModes: ["isolated", "shared"],
      status: makeStatus(),
      supportsLiveImport: true,
      workspaceMismatchCanResolveDirectly: false,
      workspaceMismatchPresent: false,
    });

    expect(presentation.activeProfileLabel).toBe("Personal");
    expect(presentation.selectedProfileLabel).toBe("Work");
    expect(presentation.primaryAction).toEqual({
      kind: "switch",
      label: "Switch",
      ariaLabel: "Switch to Work",
    });
    expect(presentation.secondaryAction).toEqual({
      kind: "open_profile",
      label: "Open Profile",
    });
    expect(presentation.menuActions.map((action) => action.kind)).toEqual([
      "open_profile",
      "import_current",
    ]);
    expect(presentation.summaryLabel).toBe("Active profile: Personal");
  });

  it("prefers reapply and workspace recovery actions when attention is required", () => {
    const snapshot = makeSnapshot({
      statuses: [
        makeStatus({
          active_profile_applied: false,
          warnings: [{ message: "Mismatch" }],
        }),
      ],
    });
    const presentation = buildOverviewInspectorPresentation({
      profiles: snapshot.profiles.claude.profiles,
      selectedProfile: "work",
      settings: makeSettings(),
      snapshot,
      stateModes: ["isolated"],
      status: snapshot.statuses[0],
      supportsLiveImport: false,
      workspaceMismatchCanResolveDirectly: true,
      workspaceMismatchPresent: true,
    });

    expect(presentation.state).toBe("needs_attention");
    expect(presentation.primaryAction).toEqual({
      kind: "reapply",
      label: "Re-apply Work",
      ariaLabel: "Re-apply Work",
    });
    expect(presentation.secondaryAction).toEqual({
      kind: "open_account_setup",
      label: "Open Account Setup",
    });
    expect(presentation.menuActions.map((action) => action.kind)).toEqual([
      "reapply",
      "open_profile",
      "resolve_workspace",
    ]);
  });

  it("keeps missing binaries on the refresh path", () => {
    const status = makeStatus({
      binary_found: false,
      active_profile: null,
      active_profile_applied: null,
    });
    const snapshot = makeSnapshot({
      statuses: [status],
      profiles: {
        claude: {
          active: null,
          profiles: [],
        },
      },
    });
    const presentation = buildOverviewInspectorPresentation({
      profiles: [],
      selectedProfile: "",
      settings: makeSettings(),
      snapshot,
      stateModes: [],
      status,
      supportsLiveImport: false,
      workspaceMismatchCanResolveDirectly: false,
      workspaceMismatchPresent: false,
    });

    expect(presentation.showActionArea).toBe(true);
    expect(presentation.showActionsMenu).toBe(true);
    expect(presentation.menuActions).toEqual([{ kind: "refresh", label: "Refresh" }]);
    expect(presentation.summaryLabel).toBe("Tool not installed");
  });
});
