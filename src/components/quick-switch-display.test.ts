import { describe, expect, it } from "vitest";
import type { AppSnapshot, DesktopSettings } from "../lib/schemas";
import { makeToolStatus } from "../test-support/runtime-tool-statuses";
import {
  buildQuickSwitchItems,
  nextQuickSwitchSelectionIndex,
  QUICK_SWITCH_COPY,
  QUICK_SWITCH_SHORTCUT_HINTS,
  quickSwitchNoMatchesDescription,
  quickSwitchOptionMetaLabel,
  quickSwitchResultCountLabel,
  quickSwitchShortcutSummary,
  quickSwitchStatusCopy,
} from "./quick-switch-display";

function makeSettings(): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {
      claude: {
        work: "Office",
      },
    },
    profile_sets: [
      {
        name: "client-acme",
        label: "Client Acme",
        profiles: {
          claude: "work",
          codex: "work",
        },
      },
    ],
  };
}

function makeSnapshot(): AppSnapshot {
  return {
    statuses: [
      makeToolStatus("claude", {
        stored_profiles: 1,
        active_profile: "work",
        active_profile_applied: true,
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
      }),
      makeToolStatus("codex", {
        stored_profiles: 1,
        active_profile: "work",
        active_profile_applied: true,
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
      }),
    ],
    profiles: {
      claude: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "Office" }],
      },
      codex: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: null }],
      },
    },
    contexts: [],
    workspace_status: {},
    project_bindings: {},
  };
}

describe("quick-switch-display", () => {
  it("builds sorted quick switch items with saved labels", () => {
    const items = buildQuickSwitchItems(makeSettings(), makeSnapshot());

    expect(items.map((item) => item.id)).toEqual([
      "set:client-acme",
      "shared:work",
      "tool:claude:work",
      "tool:codex:work",
    ]);
    expect(items[0]).toMatchObject({
      kind: "profile_set",
      title: "Client Acme",
      active: true,
    });
    expect(items[1]).toMatchObject({
      kind: "shared_profile",
      title: "Office",
      subtitle: "Across Claude Code, Codex CLI",
      active: true,
    });
    expect(items[2]).toMatchObject({
      kind: "tool_profile",
      group: "Claude Code",
      title: "Office",
      subtitle: "Claude Code · work · oauth",
      active: true,
    });
  });

  it("shares quick switch status copy and shortcuts", () => {
    const items = buildQuickSwitchItems(makeSettings(), makeSnapshot());

    expect(QUICK_SWITCH_COPY.searchPlaceholder).toBe("Search profiles or sets");
    expect(QUICK_SWITCH_COPY.currentBadgeLabel).toBe("Current");
    expect(QUICK_SWITCH_SHORTCUT_HINTS).toEqual([
      { keys: ["↑", "↓"], label: "Move" },
      { keys: ["Enter"], label: "Switch" },
      { keys: ["⌘", "Enter"], label: "Match all" },
      { keys: ["Esc"], label: "Close" },
    ]);
    expect(quickSwitchShortcutSummary(items[0])).toBe("Enter switches set");
    expect(quickSwitchShortcutSummary(items[2])).toBe("⌘Enter matches tools");
    expect(quickSwitchStatusCopy(items[0])).toEqual({
      label: "Sets",
      title: "Client Acme",
      subtitle: "Current selection",
      shortcut: "Enter switches set",
    });
    expect(quickSwitchStatusCopy(null)).toEqual({
      label: "Selection",
      title: "No matches",
      subtitle: "Search by set name, tool, profile name, or saved label.",
      shortcut: null,
    });
    expect(quickSwitchOptionMetaLabel(true)).toBe("Selected");
    expect(quickSwitchOptionMetaLabel(false)).toBe("Return");
  });

  it("shares result-count and empty-state copy", () => {
    expect(quickSwitchResultCountLabel(1)).toBe("1 result");
    expect(quickSwitchResultCountLabel(3)).toBe("3 results");
    expect(quickSwitchNoMatchesDescription()).toBe(
      "Search by set name, tool, profile name, or saved label.",
    );
    expect(nextQuickSwitchSelectionIndex(0, 0, "next")).toBe(0);
    expect(nextQuickSwitchSelectionIndex(0, 3, "next")).toBe(1);
    expect(nextQuickSwitchSelectionIndex(2, 3, "next")).toBe(0);
    expect(nextQuickSwitchSelectionIndex(0, 3, "previous")).toBe(2);
  });
});
