import { describe, expect, it } from "vitest";
import type { AppSnapshot } from "./schemas";
import {
  diagnosticCheckRows,
  diagnosticFindingTitle,
  diagnosticToolStatusLabel,
} from "./diagnostic-display";

function makeSnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    statuses: [],
    profiles: {},
    contexts: [],
    ...overrides,
  };
}

describe("diagnostic-display", () => {
  it("normalizes tool issue titles from runtime state", () => {
    const snapshot = makeSnapshot({
      statuses: [
        {
          tool: "claude",
          binary_found: false,
          stored_profiles: 0,
          active_profile: null,
          warnings: [],
        },
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
          active_profile_applied: false,
          warnings: [],
        },
      ],
    });

    expect(
      diagnosticFindingTitle(
        { title: "tool/claude", status: "fail", issues: [], remediation: [] },
        snapshot,
      ),
    ).toBe("claude is missing");
    expect(
      diagnosticFindingTitle(
        {
          title: "tool/codex",
          status: "warn",
          issues: [],
          remediation: ["Re-apply the saved profile."],
        },
        snapshot,
      ),
    ).toBe("codex live mismatch");
  });

  it("normalizes named non-tool failures", () => {
    const snapshot = makeSnapshot();

    expect(
      diagnosticFindingTitle(
        { title: "permission check", status: "warn", issues: [], remediation: [] },
        snapshot,
      ),
    ).toBe("Permissions incorrect");
    expect(
      diagnosticFindingTitle(
        { title: "oauth timeout", status: "fail", issues: [], remediation: [] },
        snapshot,
      ),
    ).toBe("OAuth failure");
    expect(
      diagnosticFindingTitle(
        { title: "shell init", status: "warn", issues: [], remediation: [] },
        snapshot,
      ),
    ).toBe("Shell hook not installed");
  });

  it("formats tool status labels", () => {
    expect(
      diagnosticToolStatusLabel({
        tool: "claude",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "work",
        warnings: [],
      }),
    ).toBe("Claude Code is using work");
  });

  it("builds summary and per-tool diagnostic rows", () => {
    const snapshot = makeSnapshot({
      statuses: [
        {
          tool: "claude",
          binary_found: false,
          stored_profiles: 0,
          active_profile: null,
          warnings: [],
        },
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
          active_profile_applied: false,
          warnings: [],
        },
        {
          tool: "gemini",
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          warnings: [],
        },
      ],
    });

    const rows = diagnosticCheckRows(
      [{ title: "Health scan", status: "unknown", lines: ["1 check"] }],
      snapshot,
    );

    expect(rows[0]).toEqual({
      label: "Health scan",
      detail: "1 check",
      status: "pass",
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          label: "Claude Code availability",
          detail: "Claude Code is not installed on this computer yet.",
          status: "warn",
        },
        {
          label: "Codex CLI live match",
          detail: "Codex CLI no longer matches the active saved profile.",
          status: "warn",
        },
        {
          label: "Gemini CLI status",
          detail: "Gemini CLI is installed, but no saved profile is configured yet.",
          status: "warn",
        },
      ]),
    );
  });
});
