import { describe, expect, it } from "vitest";
import type { DesktopSettings } from "../../lib/schemas";
import {
  createEditableProfileSetDraft,
  createEditableRuleDraft,
  createEmptyEditableProfileSet,
  createEmptyRuleDraft,
  duplicateEditableProfileSetDraft,
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
});
