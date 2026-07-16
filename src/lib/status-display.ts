import type { ToolStatus } from "./schemas";
import {
  ACTIVE_LABEL,
  AVAILABLE_AFTER_ACTIVATION_LABEL,
  BLOCKED_LABEL,
  NEEDS_ATTENTION_LABEL,
  NEEDS_ATTENTION_SENTENCE_LABEL,
  NEEDS_REAPPLY_LABEL,
  NOT_CONFIGURED_LABEL,
  NOT_CONFIGURED_TITLE_LABEL,
  NOT_INSTALLED_LABEL,
  NOT_VERIFIED_LABEL,
  NOT_VERIFIED_YET_LABEL,
  NO_PROFILE_LABEL,
  NO_SAVED_PROFILE_YET_LABEL,
  READY_LABEL,
  STORED_LABEL,
  TOOL_NOT_INSTALLED_LABEL,
  UNAVAILABLE_LABEL,
  VERIFIED_IN_THIS_SESSION_LABEL,
  VERIFICATION_PENDING_LABEL,
} from "./status-copy";

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

const OVERVIEW_HEALTH_LABELS: Record<OverviewHealthState, string> = {
  ready: READY_LABEL,
  needs_attention: NEEDS_ATTENTION_LABEL,
  blocked: BLOCKED_LABEL,
  not_configured: NOT_CONFIGURED_TITLE_LABEL,
  not_verified: NOT_VERIFIED_LABEL,
};

const OVERVIEW_HEALTH_TEXT_LABELS: Record<OverviewHealthState, string> = {
  ready: READY_LABEL,
  needs_attention: NEEDS_ATTENTION_SENTENCE_LABEL,
  blocked: BLOCKED_LABEL,
  not_configured: NOT_CONFIGURED_LABEL,
  not_verified: NOT_VERIFIED_LABEL,
};

const OVERVIEW_HEALTH_SYMBOLS: Record<OverviewHealthState, string> = {
  ready: "●",
  needs_attention: "▲",
  blocked: "⨯",
  not_configured: "○",
  not_verified: "?",
};

const PROFILE_SWITCH_LABELS: Record<ProfileSwitchState, string> = {
  stored: STORED_LABEL,
  live_mismatch: NEEDS_ATTENTION_LABEL,
  not_verified: NOT_VERIFIED_LABEL,
  active: ACTIVE_LABEL,
};

const PROFILE_SWITCH_SYMBOLS: Record<ProfileSwitchState, string> = {
  stored: "○",
  live_mismatch: "▲",
  not_verified: "?",
  active: "●",
};

const PROFILE_LIVE_MATCH_LABELS: Record<ProfileSwitchState, string> = {
  stored: AVAILABLE_AFTER_ACTIVATION_LABEL,
  not_verified: NOT_VERIFIED_LABEL,
  live_mismatch: NEEDS_ATTENTION_LABEL,
  active: READY_LABEL,
};

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
  return OVERVIEW_HEALTH_LABELS[state];
}

export function overviewHealthText(status: ToolStatus, state: OverviewHealthState) {
  if (!status.binary_found) {
    return NOT_INSTALLED_LABEL;
  }
  if (!status.active_profile) {
    return NOT_CONFIGURED_LABEL;
  }
  if (status.active_profile_applied === false) {
    return "Live mismatch";
  }
  return OVERVIEW_HEALTH_TEXT_LABELS[state];
}

export function overviewHealthSymbol(state: OverviewHealthState) {
  return OVERVIEW_HEALTH_SYMBOLS[state];
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
  return PROFILE_SWITCH_LABELS[state];
}

export function profileSwitchSymbol(state: ProfileSwitchState) {
  return PROFILE_SWITCH_SYMBOLS[state];
}

export function profileLiveMatchLabel(state: ProfileSwitchState) {
  return PROFILE_LIVE_MATCH_LABELS[state];
}

export function toolListEmptyLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return NOT_INSTALLED_LABEL;
  }
  if (!status.active_profile) {
    return NO_PROFILE_LABEL;
  }
  return VERIFICATION_PENDING_LABEL;
}

export function toolInspectorEmptyLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return TOOL_NOT_INSTALLED_LABEL;
  }
  if (!status.active_profile) {
    return NO_SAVED_PROFILE_YET_LABEL;
  }
  return NOT_VERIFIED_YET_LABEL;
}

export function toolVerificationLabel(status: ToolStatus) {
  if (!status.binary_found || !status.active_profile) {
    return UNAVAILABLE_LABEL;
  }
  if (status.active_profile_applied === true) {
    return VERIFIED_IN_THIS_SESSION_LABEL;
  }
  if (status.active_profile_applied === false) {
    return NEEDS_REAPPLY_LABEL;
  }
  return NOT_VERIFIED_YET_LABEL;
}
