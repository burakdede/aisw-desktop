import { describe, expect, it } from "vitest";
import type { ToolStatus } from "./schemas";
import {
  overviewAuthMethodLabel,
  overviewDiagnosticWarning,
  overviewHeadline,
  overviewMetaLabel,
  overviewRecentSummary,
  overviewStateModeCopy,
  overviewTokenWarning,
  overviewWorkspaceActionLabel,
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

describe("overview-display", () => {
  it("shares overall overview health presentation", () => {
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
    expect(overviewWorkspaceActionLabel(true)).toBe("Use Expected Set");
    expect(overviewWorkspaceActionLabel(false)).toBe("Open Sets");
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
    expect(overviewAuthMethodLabel("api_key")).toBe("Api Key");
    expect(overviewAuthMethodLabel(null)).toBe("Not configured");
  });
});
