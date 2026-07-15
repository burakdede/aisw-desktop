import type { ToolStatus } from "./schemas";

export type OverviewHealthState =
  | "ready"
  | "needs_attention"
  | "blocked"
  | "not_configured"
  | "not_verified";

export type ProfileSwitchState =
  | "stored"
  | "active"
  | "not_verified"
  | "live_mismatch";

export function resolveOverviewHealthState(status: ToolStatus): OverviewHealthState {
  if (!status.binary_found) {
    return "blocked";
  }
  if (!status.active_profile) {
    return "not_configured";
  }
  if (status.active_profile_applied === false || status.token_warning || status.warnings.length) {
    return "needs_attention";
  }
  if (status.active_profile_applied === null || status.active_profile_applied === undefined) {
    return "not_verified";
  }
  return "ready";
}

export function overviewHealthLabel(state: OverviewHealthState) {
  switch (state) {
    case "ready":
      return "Ready";
    case "needs_attention":
      return "Needs Attention";
    case "blocked":
      return "Blocked";
    case "not_configured":
      return "Not Configured";
    case "not_verified":
      return "Not Verified";
  }
}

export function overviewHealthText(status: ToolStatus, state: OverviewHealthState) {
  if (!status.binary_found) {
    return "Not installed";
  }
  if (!status.active_profile) {
    return "Not configured";
  }
  if (status.active_profile_applied === false) {
    return "Live mismatch";
  }

  switch (state) {
    case "ready":
      return "Ready";
    case "needs_attention":
      return "Needs attention";
    case "blocked":
      return "Blocked";
    case "not_configured":
      return "Not configured";
    case "not_verified":
      return "Not verified";
  }
}

export function overviewHealthSymbol(state: OverviewHealthState) {
  switch (state) {
    case "ready":
      return "●";
    case "needs_attention":
      return "▲";
    case "blocked":
      return "⨯";
    case "not_configured":
      return "○";
    case "not_verified":
      return "?";
  }
}

export function resolveProfileSwitchState(input: {
  activeProfile: string | null | undefined;
  profileName: string;
  activeProfileApplied: boolean | null | undefined;
}): ProfileSwitchState {
  if (input.activeProfile !== input.profileName) {
    return "stored";
  }
  if (input.activeProfileApplied === false) {
    return "live_mismatch";
  }
  if (input.activeProfileApplied === null || input.activeProfileApplied === undefined) {
    return "not_verified";
  }
  return "active";
}

export function profileSwitchTone(state: ProfileSwitchState) {
  switch (state) {
    case "stored":
    case "not_verified":
      return "stored";
    case "live_mismatch":
      return "warn";
    case "active":
      return "ok";
  }
}

export function profileSwitchLabel(state: ProfileSwitchState) {
  switch (state) {
    case "stored":
      return "Stored";
    case "live_mismatch":
      return "Needs Attention";
    case "not_verified":
      return "Not Verified";
    case "active":
      return "Active";
  }
}

export function profileSwitchSymbol(state: ProfileSwitchState) {
  switch (state) {
    case "stored":
      return "○";
    case "live_mismatch":
      return "▲";
    case "not_verified":
      return "?";
    case "active":
      return "●";
  }
}

export function profileLiveMatchLabel(state: ProfileSwitchState) {
  switch (state) {
    case "stored":
      return "Available after activation";
    case "not_verified":
      return "Not Verified";
    case "live_mismatch":
      return "Needs Attention";
    case "active":
      return "Ready";
  }
}

export function toolListEmptyLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return "Not installed";
  }
  if (!status.active_profile) {
    return "No profile";
  }
  return "Verification pending";
}

export function toolInspectorEmptyLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return "Tool not installed";
  }
  if (!status.active_profile) {
    return "No saved profile yet";
  }
  return "Not verified yet";
}

export function toolVerificationLabel(status: ToolStatus) {
  if (!status.binary_found || !status.active_profile) {
    return "Unavailable";
  }
  if (status.active_profile_applied === true) {
    return "Verified in this session";
  }
  if (status.active_profile_applied === false) {
    return "Needs re-apply";
  }
  return "Not verified yet";
}
