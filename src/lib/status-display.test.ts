import { describe, expect, it } from "vitest";
import type { ToolStatus } from "./schemas";
import {
  overviewHealthLabel,
  overviewHealthSymbol,
  overviewHealthText,
  profileLiveMatchLabel,
  profileSwitchLabel,
  profileSwitchSymbol,
  profileSwitchTone,
  resolveOverviewHealthState,
  resolveProfileSwitchState,
} from "./status-display";

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

describe("status-display", () => {
  it("resolves overview health states and presentation", () => {
    expect(resolveOverviewHealthState(makeStatus({ binary_found: false }))).toBe("blocked");
    expect(resolveOverviewHealthState(makeStatus({ active_profile: null }))).toBe("not_configured");
    expect(resolveOverviewHealthState(makeStatus({ active_profile_applied: null }))).toBe("not_verified");
    expect(resolveOverviewHealthState(makeStatus({ active_profile_applied: false }))).toBe("needs_attention");
    expect(resolveOverviewHealthState(makeStatus())).toBe("ready");

    expect(overviewHealthLabel("needs_attention")).toBe("Needs Attention");
    expect(overviewHealthSymbol("not_verified")).toBe("?");
    expect(overviewHealthText(makeStatus({ binary_found: false }), "blocked")).toBe("Not installed");
    expect(overviewHealthText(makeStatus({ active_profile_applied: false }), "needs_attention")).toBe("Live mismatch");
  });

  it("resolves profile switch states and presentation", () => {
    const storedState = resolveProfileSwitchState({
      activeProfile: "work",
      profileName: "personal",
      activeProfileApplied: true,
    });
    const mismatchState = resolveProfileSwitchState({
      activeProfile: "personal",
      profileName: "personal",
      activeProfileApplied: false,
    });
    const pendingState = resolveProfileSwitchState({
      activeProfile: "personal",
      profileName: "personal",
      activeProfileApplied: null,
    });
    const activeState = resolveProfileSwitchState({
      activeProfile: "personal",
      profileName: "personal",
      activeProfileApplied: true,
    });

    expect(storedState).toBe("stored");
    expect(mismatchState).toBe("live_mismatch");
    expect(pendingState).toBe("not_verified");
    expect(activeState).toBe("active");

    expect(profileSwitchTone(storedState)).toBe("stored");
    expect(profileSwitchTone(mismatchState)).toBe("warn");
    expect(profileSwitchLabel(mismatchState)).toBe("Needs Attention");
    expect(profileSwitchSymbol(pendingState)).toBe("?");
    expect(profileLiveMatchLabel(storedState)).toBe("Available after activation");
    expect(profileLiveMatchLabel(activeState)).toBe("Ready");
  });
});
