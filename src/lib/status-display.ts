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

export type OverviewHealthPresentation = {
  state: OverviewHealthState;
  label: string;
  text: string;
  symbol: string;
};

export type ProfileSwitchState =
  | "stored"
  | "active"
  | "not_verified"
  | "live_mismatch";

type ToolVerificationState =
  | "not_installed"
  | "no_profile"
  | "verified"
  | "needs_reapply"
  | "not_verified";

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

const PROFILE_SWITCH_TONES: Record<ProfileSwitchState, "stored" | "warn" | "ok"> = {
  stored: "stored",
  not_verified: "stored",
  live_mismatch: "warn",
  active: "ok",
};

const PROFILE_LIVE_MATCH_LABELS: Record<ProfileSwitchState, string> = {
  stored: AVAILABLE_AFTER_ACTIVATION_LABEL,
  not_verified: NOT_VERIFIED_LABEL,
  live_mismatch: NEEDS_ATTENTION_LABEL,
  active: READY_LABEL,
};

const TOOL_LIST_EMPTY_LABELS: Record<
  Extract<ToolVerificationState, "not_installed" | "no_profile" | "not_verified">,
  string
> = {
  not_installed: NOT_INSTALLED_LABEL,
  no_profile: NO_PROFILE_LABEL,
  not_verified: VERIFICATION_PENDING_LABEL,
};

const TOOL_INSPECTOR_EMPTY_LABELS: Record<
  Extract<ToolVerificationState, "not_installed" | "no_profile" | "not_verified">,
  string
> = {
  not_installed: TOOL_NOT_INSTALLED_LABEL,
  no_profile: NO_SAVED_PROFILE_YET_LABEL,
  not_verified: NOT_VERIFIED_YET_LABEL,
};

const TOOL_VERIFICATION_LABELS: Record<ToolVerificationState, string> = {
  not_installed: UNAVAILABLE_LABEL,
  no_profile: UNAVAILABLE_LABEL,
  verified: VERIFIED_IN_THIS_SESSION_LABEL,
  needs_reapply: NEEDS_REAPPLY_LABEL,
  not_verified: NOT_VERIFIED_YET_LABEL,
};

const OVERVIEW_LIVE_MISMATCH_TEXT = "Live mismatch";

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
  const verificationState = resolveToolVerificationState(status);
  if (verificationState === "not_installed") {
    return NOT_INSTALLED_LABEL;
  }
  if (verificationState === "no_profile") {
    return NOT_CONFIGURED_LABEL;
  }
  if (verificationState === "needs_reapply") {
    return OVERVIEW_LIVE_MISMATCH_TEXT;
  }
  return OVERVIEW_HEALTH_TEXT_LABELS[state];
}

export function overviewHealthSymbol(state: OverviewHealthState) {
  return OVERVIEW_HEALTH_SYMBOLS[state];
}

export function overviewHealthPresentation(
  state: OverviewHealthState,
  text: string,
): OverviewHealthPresentation {
  return {
    state,
    label: overviewHealthLabel(state),
    text,
    symbol: overviewHealthSymbol(state),
  };
}

export function buildOverviewToolHealthPresentation(
  status: ToolStatus,
): OverviewHealthPresentation {
  const state = resolveOverviewHealthState(status);
  return overviewHealthPresentation(state, overviewHealthText(status, state));
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
  return PROFILE_SWITCH_TONES[state];
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
  return TOOL_LIST_EMPTY_LABELS[resolveUnverifiedToolState(status)];
}

export function toolInspectorEmptyLabel(status: ToolStatus) {
  return TOOL_INSPECTOR_EMPTY_LABELS[resolveUnverifiedToolState(status)];
}

export function toolVerificationLabel(status: ToolStatus) {
  return TOOL_VERIFICATION_LABELS[resolveToolVerificationState(status)];
}

function resolveToolVerificationState(status: ToolStatus): ToolVerificationState {
  if (!status.binary_found) {
    return "not_installed";
  }
  if (!status.active_profile) {
    return "no_profile";
  }
  if (status.active_profile_applied === true) {
    return "verified";
  }
  if (status.active_profile_applied === false) {
    return "needs_reapply";
  }
  return "not_verified";
}

function resolveUnverifiedToolState(
  status: ToolStatus,
): Extract<ToolVerificationState, "not_installed" | "no_profile" | "not_verified"> {
  const verificationState = resolveToolVerificationState(status);
  if (
    verificationState === "not_installed" ||
    verificationState === "no_profile" ||
    verificationState === "not_verified"
  ) {
    return verificationState;
  }

  return "not_verified";
}
