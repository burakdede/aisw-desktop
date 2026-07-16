import { describe, expect, it } from "vitest";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "../../lib/schemas";
import {
  DIAGNOSTICS_PANEL_COPY,
  buildDiagnosticQuickFixModels,
  buildDiagnosticInspectorActions,
  buildDiagnosticFindings,
  buildDiagnosticsStatusMessage,
  buildDiagnosticsSummary,
  buildSelectedRepairFixes,
  buildRecentFailureCards,
  diagnosticBundlePathCopyMessage,
  diagnosticInspectorStatusLabel,
  diagnosticsApplyRepairsLabel,
  diagnosticsRepairPlanSummary,
  diagnosticsRepairSelectionLabel,
  diagnosticTechnicalCommandBlock,
  diagnosticQuickFixKey,
  diagnosticRepairActionKey,
  diagnosticRepairFixFromAction,
  formatRelativeVerifiedTime,
  groupDiagnosticFindings,
  impactTextForFinding,
  matchesQuickFixToFinding,
  recentFailureTitle,
  resolveSelectedFindingKey,
  type DiagnosticFinding,
} from "./diagnostics-panel-display";
import type { IssueCardData } from "./diagnostic-parsers";

function makeSnapshot(): AppSnapshot {
  return {
    statuses: [
      {
        tool: "claude",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "work",
        active_profile_applied: false,
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
        warnings: [],
        token_warning: null,
      },
      {
        tool: "codex",
        binary_found: false,
        stored_profiles: 0,
        active_profile: null,
        active_profile_applied: null,
        auth_method: null,
        credential_backend: null,
        state_mode: null,
        warnings: [],
        token_warning: null,
      },
    ],
    profiles: {
      claude: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "Work" }],
      },
      codex: {
        active: null,
        profiles: [],
      },
    },
    contexts: [],
    workspace_status: {},
    project_bindings: {},
  };
}

function makeIssue(title: string, overrides: Partial<IssueCardData> = {}): IssueCardData {
  return {
    title,
    status: "warn",
    issues: ["AISW cannot update permissions."],
    remediation: ["Repair permissions"],
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

function makeToolCapabilities(): NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"] {
  return {
    claude: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["file", "system_keyring"],
      fail_closed_keyring_identity: false,
    },
    codex: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["file", "system_keyring"],
      fail_closed_keyring_identity: false,
    },
  };
}

describe("diagnostics-panel-display", () => {
  it("shares stable diagnostics panel copy", () => {
    expect(DIAGNOSTICS_PANEL_COPY.verifyButtonLabel).toBe("Verify");
    expect(DIAGNOSTICS_PANEL_COPY.reviewSafeFixesButtonLabel).toBe("Review Safe Fixes…");
    expect(DIAGNOSTICS_PANEL_COPY.applySafeFixesAriaLabel).toBe("Apply Safe Fixes");
    expect(DIAGNOSTICS_PANEL_COPY.healthyTitle).toBe("Everything looks good");
    expect(DIAGNOSTICS_PANEL_COPY.technicalDetailsIntro).toBe(
      "Suggested commands for validation and recovery.",
    );
    expect(DIAGNOSTICS_PANEL_COPY.copyReportPathLabel).toBe("Copy report path");
    expect(diagnosticInspectorStatusLabel("fail")).toBe("Blocked");
    expect(diagnosticInspectorStatusLabel("warn")).toBe("Needs attention");
    expect(diagnosticTechnicalCommandBlock("Re-apply Work")).toContain("# Re-apply Work");
    expect(diagnosticTechnicalCommandBlock(null)).toContain(
      "# Review the explicit action above",
    );
    expect(diagnosticsRepairPlanSummary(1)).toBe(
      "1 repair can be applied without changing account identity.",
    );
    expect(diagnosticsRepairPlanSummary(3)).toBe(
      "3 repairs can be applied without changing account identity.",
    );
    expect(diagnosticsRepairSelectionLabel(2)).toBe("2 selected");
    expect(diagnosticsApplyRepairsLabel(2, true)).toBe("Applying Repairs…");
    expect(diagnosticsApplyRepairsLabel(2, false)).toBe("Apply 2 Fixes");
  });

  it("builds recent failure titles and cards", () => {
    expect(
      recentFailureTitle({
        kind: "ToolMissing",
        scope: "tool",
        tool: "claude",
        label: "Install",
      }),
    ).toBe("Claude CLI missing");
    expect(
      recentFailureTitle({
        kind: undefined,
        scope: "global",
        id: "backup",
        label: "Restore backup",
      }),
    ).toBe("Backup restore needs attention");

    const cards = buildRecentFailureCards(
      {
        tool: {
          claude: {
            label: "Use profile",
            status: "error",
            message: "Profile failed.",
            at: 20,
          },
        },
        global: {
          workspace: {
            label: "Use expected set now",
            status: "error",
            message: "Mismatch.",
            kind: "PermissionDenied",
            at: 30,
          },
        },
      },
      makeSnapshot(),
    );

    expect(cards.map((card) => card.key)).toEqual(["global:workspace", "tool:claude"]);
    expect(cards[0].title).toBe("Permission issue");
    expect(cards[1].profileTarget).toEqual({ tool: "claude", profile: "work" });
  });

  it("builds and groups findings with normalized quick fixes", () => {
    const snapshot = makeSnapshot();
    const issues = [
      makeIssue("claude", {
        issues: ["AISW cannot load CLI context."],
        remediation: ["Re-apply work"],
      }),
      makeIssue("permissions", {
        issues: ["Permissions need review."],
      }),
    ];
    const findings = buildDiagnosticFindings(
      issues,
      [
        {
          key: "tool:claude",
          title: "Claude live mismatch",
          message: "AISW cannot load CLI context.",
          at: 10,
          profileTarget: { tool: "claude", profile: "work" },
        },
      ],
      [
        {
          title: "Use file-backed storage",
          detail: "Open account setup.",
          label: "Use file-backed storage",
          status: "warn",
        },
      ],
      snapshot,
    );

    expect(findings[0].title).toBe("claude live mismatch");
    expect(findings[0].preview).toBe("AI Switch cannot load set.");
    expect(findings.some((finding) => finding.title === "Use file-backed storage")).toBe(true);
    expect(groupDiagnosticFindings(findings).map((group) => group.label)).toEqual([
      "Blocked",
      "Needs Attention",
      "Suggestions",
    ]);
  });

  it("matches quick fixes, impact copy, and relative verification labels", () => {
    const finding: DiagnosticFinding = {
      key: "finding-1",
      title: "Keyring unavailable",
      preview: "Keyring issue",
      lines: [],
      remediation: [],
      status: "warn",
      scopeLabel: "Check",
      countLabel: "1 detail",
      profileTarget: { tool: "claude", profile: "work" },
    };

    expect(
      matchesQuickFixToFinding(
        {
          title: "Use file-backed storage",
          detail: "Open account setup.",
          label: "Use file-backed storage",
          status: "warn",
        },
        finding,
      ),
    ).toBe(true);
    expect(impactTextForFinding(finding)).toContain("Stored credentials");
    expect(formatRelativeVerifiedTime(1000, 1005)).toBe("just now");
    expect(formatRelativeVerifiedTime(1000, 25_000)).toBe("24 sec ago");
    expect(formatRelativeVerifiedTime(1000, 181_000)).toBe("3 min ago");
    expect(formatRelativeVerifiedTime(1000, 7_201_000)).toBe("2 hr ago");
    expect(formatRelativeVerifiedTime(1000, 172_801_000)).toBe("2 days ago");
    expect(diagnosticQuickFixKey({ title: "Repair permissions", label: "Apply" })).toBe(
      "Repair permissions:Apply",
    );
    expect(
      diagnosticRepairActionKey({ title: "Repair permissions", detail: "Fix filesystem access." }),
    ).toBe("Repair permissions:Fix filesystem access.");
    expect(
      diagnosticRepairFixFromAction({ title: "Repair permissions", detail: "Fix filesystem access." }),
    ).toBe("repair_permissions");
    expect(
      diagnosticRepairFixFromAction({
        title: "Repair permissions",
        detail: "Fix filesystem access.",
        fix: "permissions",
      }),
    ).toBe("permissions");
    expect(diagnosticBundlePathCopyMessage("/tmp/report.zip", false)).toContain("manually");
    expect(diagnosticBundlePathCopyMessage("/tmp/report.zip", true)).toBe(
      "Copied bundle path /tmp/report.zip.",
    );
  });

  it("builds summary, footer status, selected repairs, and selected finding fallbacks", () => {
    expect(buildDiagnosticsSummary(2, 1)).toEqual({
      title: "2 issues need attention",
      detail: "1 repair can be applied safely. 1 issue requires a decision.",
    });
    expect(buildDiagnosticsSummary(0, 0)).toEqual({
      title: "Everything looks good",
      detail: "All configured tools match their active AISW profiles and local storage checks passed.",
    });

    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "Copied bundle path /tmp/report.zip.",
        exportedBundle: { filename: "report.zip", path: "/tmp/report.zip" },
        exportErrorMessage: "Support report export failed.",
        appliedFixCount: 2,
      }),
    ).toBe("Copied bundle path /tmp/report.zip.");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
        exportedBundle: { filename: "report.zip", path: "/tmp/report.zip" },
      }),
    ).toBe("Support report ready: report.zip. /tmp/report.zip");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
        exportErrorMessage: "Support report export failed.",
      }),
    ).toBe("Support report export failed.");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
        appliedFixCount: 2,
      }),
    ).toBe("Applied 2 safe fixes.");
    expect(
      buildDiagnosticsStatusMessage({
        bundleCopyMessage: "",
      }),
    ).toBe("");

    expect(
      buildSelectedRepairFixes(["permissions:Permissions need review."], [
        { title: "permissions", detail: "Permissions need review.", fix: "permissions" },
        { title: "keyring", detail: "Keyring access failed.", fix: "keyring" },
      ]),
    ).toEqual(["permissions"]);

    expect(
      resolveSelectedFindingKey("finding-1", [{ key: "finding-1" } as DiagnosticFinding]),
    ).toBe("finding-1");
    expect(resolveSelectedFindingKey("missing", [{ key: "finding-2" } as DiagnosticFinding])).toBe(
      "finding-2",
    );
    expect(resolveSelectedFindingKey(null, [])).toBeNull();
  });

  it("builds diagnostics inspector actions with stable precedence", () => {
    const selectedFinding: DiagnosticFinding = {
      key: "finding-1",
      title: "Claude live mismatch",
      preview: "Mismatch",
      lines: [],
      remediation: [],
      status: "fail",
      scopeLabel: "Check",
      countLabel: "1 detail",
      profileTarget: { tool: "claude", profile: "work" },
    };

    const primaryFindingFix = {
      title: "Claude live mismatch",
      label: "Re-apply Work",
      importTarget: { tool: "claude", stateMode: "isolated" },
      importFallbackMode: "from_live",
      secondaryAction: { label: "Open Settings" },
    };
    const secondaryFindingFixes = [
      {
        title: "Permission issue",
        label: "Repair permissions",
      },
      {
        title: "Terminal integration not active",
        label: "Open terminal setup",
      },
    ];

    const actions = buildDiagnosticInspectorActions({
      selectedFinding,
      primaryFindingFix,
      secondaryFindingFixes,
      importCurrentLabel: "Import Current…",
    });

    expect(actions.secondaryInspectorAction).toEqual({
      key: "secondary-Claude live mismatch:Re-apply Work",
      kind: "quick_fix_secondary",
      label: "Open Settings",
      quickFixKey: "Claude live mismatch:Re-apply Work",
    });
    expect(actions.overflowActions).toEqual([
      {
        key: "import-Claude live mismatch:Re-apply Work",
        kind: "import_current",
        label: "Import Current…",
        importTarget: { tool: "claude", stateMode: "isolated" },
        importFallbackMode: "from_live",
      },
      {
        key: "fix-Permission issue:Repair permissions",
        kind: "quick_fix",
        label: "Repair permissions",
        quickFixKey: "Permission issue:Repair permissions",
      },
      {
        key: "fix-Terminal integration not active:Open terminal setup",
        kind: "quick_fix",
        label: "Open terminal setup",
        quickFixKey: "Terminal integration not active:Open terminal setup",
      },
      {
        key: "profile-finding-1",
        kind: "open_profile_details",
        label: "Open Profile Details",
        profileTarget: { tool: "claude", profile: "work" },
      },
    ]);
  });

  it("falls back from secondary actions to quick fixes, profile details, and import", () => {
    const selectedFinding: DiagnosticFinding = {
      key: "finding-2",
      title: "OAuth failure",
      preview: "OAuth",
      lines: [],
      remediation: [],
      status: "warn",
      scopeLabel: "Check",
      countLabel: "1 detail",
      profileTarget: { tool: "claude", profile: "work" },
    };

    const quickFixFirst = buildDiagnosticInspectorActions({
      selectedFinding,
      primaryFindingFix: null,
      secondaryFindingFixes: [{ title: "Permission issue", label: "Repair permissions" }],
      importCurrentLabel: null,
    });
    expect(quickFixFirst.secondaryInspectorAction).toEqual({
      key: "fix-Permission issue:Repair permissions",
      kind: "quick_fix",
      label: "Repair permissions",
      quickFixKey: "Permission issue:Repair permissions",
    });

    const profileFallback = buildDiagnosticInspectorActions({
      selectedFinding,
      primaryFindingFix: null,
      secondaryFindingFixes: [],
      importCurrentLabel: null,
    });
    expect(profileFallback.secondaryInspectorAction).toEqual({
      key: "profile-finding-2",
      kind: "open_profile_details",
      label: "Open Profile Details",
      profileTarget: { tool: "claude", profile: "work" },
    });

    const importFallback = buildDiagnosticInspectorActions({
      selectedFinding: null,
      primaryFindingFix: {
        title: "Claude live mismatch",
        label: "Re-apply Work",
        importTarget: { tool: "claude", stateMode: "isolated" },
      },
      secondaryFindingFixes: [],
      importCurrentLabel: "Open Account Setup",
    });
    expect(importFallback.secondaryInspectorAction).toEqual({
      key: "import-Claude live mismatch:Re-apply Work",
      kind: "import_current",
      label: "Open Account Setup",
      importTarget: { tool: "claude", stateMode: "isolated" },
      importFallbackMode: undefined,
    });
  });

  it("builds diagnostic quick-fix models from doctor, snapshot, and workspace state", () => {
    const snapshot = makeSnapshot();
    snapshot.contexts = [{ name: "expected", profiles: { claude: "work" } }];
    snapshot.workspace_status = {
      result: {
        status: "mismatch",
        current_context: "current",
        expected_context: "expected",
        matched_binding: {
          scope: "path",
          path: "/tmp/project",
          context: "expected",
        },
      },
    };

    const models = buildDiagnosticQuickFixModels({
      snapshot,
      doctor: {
        checks: [
          { name: "keyring", detail: "Keyring access failed.", status: "fail" },
          { name: "shell hook", detail: "Shell hook is not active in the current shell session.", status: "warn" },
          { name: "permission", detail: "Permissions need review.", status: "warn" },
        ],
      },
      repair: {
        result: {
          actions: [
            { fix: "permissions" },
            { fix: "keyring" },
          ],
        },
      },
      settings: makeSettings(),
      toolCapabilities: makeToolCapabilities(),
    });

    expect(models.map((model) => model.kind)).toEqual([
      "repair_doctor_issue",
      "repair_doctor_issue",
      "open_settings",
      "open_profile_setup",
      "open_settings",
      "reapply_profile",
      "open_installation_guide",
      "resolve_workspace",
    ]);
    expect(models[0]).toMatchObject({
      title: "Keyring unavailable",
      label: "Apply keyring repair",
      repairFix: "keyring",
      status: "fail",
    });
    expect(models[2]).toMatchObject({
      title: "Terminal integration not active",
      detail: "Terminal integration is not active in the current shell session.",
      settingsSection: "shell",
    });
    expect(models[5]).toMatchObject({
      title: "claude live mismatch",
      label: "Re-apply Work",
      profileTarget: { tool: "claude", profile: "work" },
      importTarget: { tool: "claude", stateMode: "isolated" },
      importFallbackMode: "from_live",
      primary: true,
    });
    expect(models[6]).toMatchObject({
      title: "codex is missing",
      label: "Open installation guide",
      toolTarget: "codex",
      secondaryAction: {
        kind: "refresh_diagnostics",
        label: "Refresh diagnostics",
      },
    });
    expect(models[7]).toMatchObject({
      title: "Project set mismatch",
      label: "Use expected set now",
      matchedWorkspaceTarget: "/tmp/project",
      workspaceActivationTarget: {
        kind: "context",
        name: "expected",
        stateMode: "isolated",
      },
    });
  });
});
