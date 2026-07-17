import { describe, expect, it } from "vitest";
import {
  duplicateSetNameWarning,
  emptyRuleSetWarning,
  emptySetSelectionWarning,
  explicitRuleTargetWarning,
  importedContextActionLabel,
  importedContextStatus,
  noRecentSetWorkspaceChangesMessage,
  profileSetStatus,
  projectResultSummary,
  ruleScopeLabel,
  ruleTargetLabel,
  savedRuleStatusLabel,
  selectedRuleMatchLabel,
  selectedRulePriorityLabel,
  selectedRuleSubtitle,
  setCommandResultLabel,
  setResultSummary,
  setSelectionCountLabel,
  USE_EXPECTED_SET_LABEL,
  workspaceRuleMatchLabel,
  workspaceSetActionLabel,
} from "./sets-display";

describe("sets-display", () => {
  it("shares set and imported-context statuses", () => {
    expect(profileSetStatus(true, true)).toEqual({
      label: "Current",
      tone: "ready",
      symbol: "●",
    });
    expect(profileSetStatus(false, true)).toEqual({
      label: "Available",
      tone: "available",
      symbol: "●",
    });
    expect(profileSetStatus(false, false)).toEqual({
      label: "Needs Attention",
      tone: "warn",
      symbol: "▲",
    });

    expect(importedContextStatus(true)).toEqual({
      label: "Current",
      tone: "ready",
      symbol: "●",
    });
    expect(importedContextStatus(false)).toEqual({
      label: "Imported",
      tone: "available",
      symbol: "○",
    });
    expect(importedContextActionLabel(true, "Client Acme")).toBe("Current");
    expect(importedContextActionLabel(false, "Client Acme")).toBe("Use CLI Context Client Acme");
  });

  it("shares set editor and rule editor copy", () => {
    expect(setSelectionCountLabel(1)).toBe("1 profile mapped");
    expect(setSelectionCountLabel(3)).toBe("3 profiles mapped");
    expect(duplicateSetNameWarning("client-acme")).toBe(
      "A set named client-acme already exists. Rename the existing set or choose a different name.",
    );
    expect(emptySetSelectionWarning()).toBe(
      "Select at least one tool profile before saving this set.",
    );
    expect(emptyRuleSetWarning()).toBe(
      "No sets are available yet. Create one before saving a project rule.",
    );
    expect(explicitRuleTargetWarning("path")).toBe(
      "Enter a path prefix before saving or removing this rule.",
    );
    expect(explicitRuleTargetWarning("git_remote")).toBe(
      "Enter a git remote pattern before saving or removing this rule.",
    );
  });

  it("shares rule labels and action copy", () => {
    expect(ruleScopeLabel("path")).toBe("Folder");
    expect(ruleScopeLabel("git_remote")).toBe("Git remote");
    expect(ruleScopeLabel("default")).toBe("Default");
    expect(ruleScopeLabel("none")).toBe("No match");
    expect(ruleTargetLabel("default", "default")).toBe("Default set");
    expect(ruleTargetLabel("path", "none")).toBe("No target");
    expect(ruleTargetLabel("path", "/code/acme")).toBe("/code/acme");
    expect(workspaceSetActionLabel(true)).toBe(USE_EXPECTED_SET_LABEL);
    expect(workspaceSetActionLabel(false)).toBe("Open Sets");
    expect(workspaceRuleMatchLabel("path", "/code/acme")).toBe(
      "Matched by this folder rule: /code/acme",
    );
    expect(workspaceRuleMatchLabel("default", "default")).toBe(
      "Matched by this default rule: Default set",
    );
    expect(savedRuleStatusLabel(true)).toBe("Active");
    expect(savedRuleStatusLabel(false)).toBe("Saved");
    expect(selectedRuleSubtitle(true)).toBe("This rule currently matches");
    expect(selectedRuleSubtitle(false)).toBe("Saved project rule");
    expect(selectedRulePriorityLabel("default")).toBe("Fallback");
    expect(selectedRulePriorityLabel("path")).toBe("Explicit");
    expect(selectedRuleMatchLabel(true)).toBe("Current project");
    expect(selectedRuleMatchLabel(false)).toBe("Not matched");
  });

  it("shares normalized result summaries", () => {
    expect(
      setCommandResultLabel(
        {
          status: "error",
          message: "AISW cannot load CLI context.",
          remediation: "Re-open aisw and verify the imported context.",
        },
        "set",
      ),
    ).toBe(
      "Last set result: AI Switch cannot load set. Remediation: Re-open AI Switch and verify the set.",
    );
    expect(
      setCommandResultLabel(
        {
          status: "success",
          message: "Workspace guardrails updated.",
          remediation: "Review workspace checks.",
        },
        "project-rule",
      ),
    ).toBe(
      "Last project-rule result: Project-rule guardrails updated. Remediation: Review project-rule checks.",
    );
    expect(
      projectResultSummary({
        status: "success",
        message: "Switched project set.",
        remediation: "Verify live state.",
      }),
    ).toBe("Last project result: Switched project set. Remediation: Verify live state.");
    expect(
      setResultSummary(
        {
          status: "error",
          message: "AISW cannot load CLI context.",
          remediation: "Open Sets.",
        },
        true,
      ),
    ).toBe("Last set result: AI Switch cannot load set. Remediation: Open Sets.");
    expect(
      setResultSummary({
        status: "error",
        message: "Switched set.",
        remediation: "Verify live state.",
      }),
    ).toBe("Last set result: Switched set. Remediation: Verify live state.");
    expect(noRecentSetWorkspaceChangesMessage()).toBe(
      "No recent set or workspace changes are recorded in this session.",
    );
    expect(setCommandResultLabel(null, "set")).toBeNull();
  });
});
