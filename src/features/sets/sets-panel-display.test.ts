import { describe, expect, it } from "vitest";
import type { AppSnapshot, DesktopSettings } from "../../lib/schemas";
import {
  buildSavedSetRows,
  buildSavedSetCollection,
  buildSetSettingsUpdate,
  buildSelectedSetInspectorState,
  countRuleUsageByContext,
  createEditableProfileSetDraft,
  createEditableRuleDraft,
  createEmptyEditableProfileSet,
  createEmptyRuleDraft,
  deletedSetActionLabel,
  duplicateEditableProfileSetDraft,
  hasDuplicateSetName,
  savedSetActionLabel,
  unbindTargetForBinding,
} from "./sets-panel-display";

const TOOLS = ["claude", "codex", "gemini"] as const;

function makeSet(
  overrides: Partial<NonNullable<DesktopSettings["profile_sets"]>[number]> = {},
): NonNullable<DesktopSettings["profile_sets"]>[number] {
  return {
    name: "client-acme",
    label: "Client Acme",
    profiles: {
      claude: "work",
      codex: "work",
      gemini: null,
    },
    ...overrides,
  };
}

function makeSettings(
  overrides: Partial<DesktopSettings> = {},
): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {},
    profile_sets: [makeSet()],
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<AppSnapshot> = {},
): AppSnapshot {
  return {
    statuses: [
      {
        tool: "claude",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "work",
        auth_method: "oauth",
        credential_backend: "keychain",
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
        active_profile: "work",
        auth_method: "oauth",
        credential_backend: "keychain",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        token_warning: null,
        warnings: [],
      },
      {
        tool: "gemini",
        binary_found: true,
        stored_profiles: 1,
        active_profile: null,
        auth_method: "oauth",
        credential_backend: "keychain",
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
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "Work Claude" }],
      },
      codex: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "Work Codex" }],
      },
      gemini: {
        active: null,
        profiles: [{ name: "personal", auth: "oauth", label: "Personal Gemini" }],
      },
    },
    contexts: [],
    workspace_status: null,
    project_bindings: null,
    ...overrides,
  };
}

describe("sets-panel-display", () => {
  it("creates empty and editable set drafts for every supported tool", () => {
    expect(createEmptyEditableProfileSet(TOOLS)).toEqual({
      sourceName: null,
      name: "",
      label: "",
      profiles: {
        claude: "",
        codex: "",
        gemini: "",
      },
    });

    expect(createEditableProfileSetDraft(makeSet(), TOOLS)).toEqual({
      sourceName: "client-acme",
      name: "client-acme",
      label: "Client Acme",
      profiles: {
        claude: "work",
        codex: "work",
        gemini: "",
      },
    });
  });

  it("duplicates set drafts with stable copy naming and labels", () => {
    const localSets = [
      makeSet(),
      makeSet({ name: "client-acme-copy", label: "Client Acme Copy" }),
      makeSet({ name: "client-acme-copy-2", label: null }),
    ];

    expect(duplicateEditableProfileSetDraft(makeSet(), localSets, TOOLS)).toEqual({
      sourceName: null,
      name: "client-acme-copy-3",
      label: "Client Acme Copy",
      profiles: {
        claude: "work",
        codex: "work",
        gemini: "",
      },
    });

    expect(
      duplicateEditableProfileSetDraft(makeSet({ label: null }), [makeSet({ label: null })], TOOLS),
    ).toEqual(
      expect.objectContaining({
        name: "client-acme-copy",
        label: "client-acme Copy",
      }),
    );

    expect(hasDuplicateSetName(localSets, "client-acme-copy", null)).toBe(true);
    expect(hasDuplicateSetName(localSets, "client-acme-copy", "client-acme-copy")).toBe(false);
    expect(hasDuplicateSetName(localSets, "fresh-name", null)).toBe(false);
  });

  it("shares settings update payloads and set action copy", () => {
    const settings = makeSettings();
    const localSets = settings.profile_sets;
    const draft = {
      sourceName: "client-acme",
      name: "client-beta",
      label: "Client Beta",
      profiles: {
        claude: "work",
        codex: "",
        gemini: "",
      },
    };

    expect(buildSetSettingsUpdate(settings, [makeSet({ name: "client-beta" })])).toEqual({
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [makeSet({ name: "client-beta" })],
    });

    expect(buildSavedSetCollection(localSets, draft, "client-beta")).toEqual([
      {
        name: "client-beta",
        label: "Client Beta",
        profiles: {
          claude: "work",
          codex: null,
          gemini: null,
        },
      },
    ]);

    expect(savedSetActionLabel("client-beta", "Client Beta", false)).toBe(
      "Saved set Client Beta.",
    );
    expect(savedSetActionLabel("client-beta", "", true)).toBe(
      "Updated set client-beta.",
    );
    expect(deletedSetActionLabel(localSets, "client-acme")).toBe(
      "Deleted set Client Acme.",
    );
  });

  it("creates editable rule drafts and unbind payloads", () => {
    expect(createEmptyRuleDraft("saved-set")).toEqual({
      source: null,
      scope: "default",
      context: "saved-set",
      targetValue: "",
    });

    expect(
      createEditableRuleDraft({
        scope: "path",
        target: "/code/acme",
        context: "client-acme",
      }),
    ).toEqual({
      source: { scope: "path", path: "/code/acme" },
      scope: "path",
      context: "client-acme",
      targetValue: "/code/acme",
    });

    expect(
      createEditableRuleDraft({
        scope: "default",
        target: "default",
        context: "fallback",
      }),
    ).toEqual({
      source: { scope: "default" },
      scope: "default",
      context: "fallback",
      targetValue: "",
    });

    expect(unbindTargetForBinding("git_remote", "github.com/acme/*")).toEqual({
      scope: "git_remote",
      pattern: "github.com/acme/*",
    });
  });

  it("builds saved set rows with summaries, status, and usage counts", () => {
    const settings = makeSettings({
      profile_sets: [
        makeSet(),
        makeSet({
          name: "incomplete",
          label: null,
          profiles: { claude: "missing", codex: null, gemini: null },
        }),
      ],
    });
    const snapshot = makeSnapshot();
    const ruleUsage = countRuleUsageByContext([
      { context: "client-acme" },
      { context: "client-acme" },
      { context: "incomplete" },
    ]);

    expect(
      buildSavedSetRows({
        localSets: settings.profile_sets,
        ruleUsageCountByContext: ruleUsage,
        selectedSetName: "incomplete",
        settings,
        snapshot,
        tools: TOOLS,
      }),
    ).toEqual([
      {
        name: "client-acme",
        displayLabel: "Client Acme",
        selected: false,
        active: true,
        status: { label: "Current", tone: "ready", symbol: "●" },
        summary: "Claude: Work Claude · Codex: Work Codex · Gemini: —",
        missingSummary: null,
        usageCount: 2,
      },
      {
        name: "incomplete",
        displayLabel: "incomplete",
        selected: true,
        active: false,
        status: { label: "Needs Attention", tone: "warn", symbol: "▲" },
        summary: "Claude: Missing · Codex: — · Gemini: —",
        missingSummary: "claude: missing",
        usageCount: 1,
      },
    ]);
  });

  it("builds selected set inspector state with activation and warning policy", () => {
    const settings = makeSettings();
    const snapshot = makeSnapshot();
    const selected = buildSelectedSetInspectorState({
      selectedSet: makeSet(),
      ruleUsageCountByContext: countRuleUsageByContext([{ context: "client-acme" }]),
      settings,
      snapshot,
      tools: TOOLS,
    });

    expect(selected).toEqual({
      displayLabel: "Client Acme",
      isCurrent: true,
      canActivate: false,
      activateLabel: "Current",
      selectionCountLabel: "2 profiles mapped",
      mappedProfiles: [
        { tool: "claude", value: "Work Claude" },
        { tool: "codex", value: "Work Codex" },
        { tool: "gemini", value: "Not included" },
      ],
      projectRuleCount: 1,
      warning: null,
    });

    expect(
      buildSelectedSetInspectorState({
        selectedSet: makeSet({
          name: "empty",
          label: null,
          profiles: { claude: null, codex: null, gemini: null },
        }),
        ruleUsageCountByContext: countRuleUsageByContext([]),
        settings,
        snapshot,
        tools: TOOLS,
      }).warning,
    ).toBe("This saved set is empty and cannot be activated yet.");

    expect(
      buildSelectedSetInspectorState({
        selectedSet: makeSet({
          name: "broken",
          label: null,
          profiles: { claude: "missing", codex: null, gemini: null },
        }),
        ruleUsageCountByContext: countRuleUsageByContext([]),
        settings,
        snapshot,
        tools: TOOLS,
      }).warning,
    ).toBe("Missing mapped profiles: claude: missing");
  });
});
