import { describe, expect, it } from "vitest";
import type { AppSnapshot } from "../../lib/schemas";
import {
  buildDiagnosticFindings,
  buildRecentFailureCards,
  diagnosticQuickFixKey,
  formatRelativeVerifiedTime,
  groupDiagnosticFindings,
  impactTextForFinding,
  matchesQuickFixToFinding,
  recentFailureTitle,
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

describe("diagnostics-panel-display", () => {
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
  });
});
