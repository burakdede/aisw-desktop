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

const OVERVIEW_HEALTH_METADATA: Record<
  OverviewHealthState,
  {
    label: string;
    defaultText: string;
    symbol: string;
  }
> = {
  ready: {
    label: READY_LABEL,
    defaultText: READY_LABEL,
    symbol: "●",
  },
  needs_attention: {
    label: NEEDS_ATTENTION_LABEL,
    defaultText: NEEDS_ATTENTION_SENTENCE_LABEL,
    symbol: "▲",
  },
  blocked: {
    label: BLOCKED_LABEL,
    defaultText: BLOCKED_LABEL,
    symbol: "⨯",
  },
  not_configured: {
    label: NOT_CONFIGURED_TITLE_LABEL,
    defaultText: NOT_CONFIGURED_LABEL,
    symbol: "○",
  },
  not_verified: {
    label: NOT_VERIFIED_LABEL,
    defaultText: NOT_VERIFIED_LABEL,
    symbol: "?",
  },
};

const PROFILE_SWITCH_METADATA: Record<
  ProfileSwitchState,
  {
    label: string;
    liveMatchLabel: string;
    symbol: string;
    tone: "stored" | "warn" | "ok";
  }
> = {
  stored: {
    label: STORED_LABEL,
    liveMatchLabel: AVAILABLE_AFTER_ACTIVATION_LABEL,
    symbol: "○",
    tone: "stored",
  },
  live_mismatch: {
    label: NEEDS_ATTENTION_LABEL,
    liveMatchLabel: NEEDS_ATTENTION_LABEL,
    symbol: "▲",
    tone: "warn",
  },
  not_verified: {
    label: NOT_VERIFIED_LABEL,
    liveMatchLabel: NOT_VERIFIED_LABEL,
    symbol: "?",
    tone: "stored",
  },
  active: {
    label: ACTIVE_LABEL,
    liveMatchLabel: READY_LABEL,
    symbol: "●",
    tone: "ok",
  },
};

const TOOL_VERIFICATION_METADATA: Record<
  ToolVerificationState,
  {
    verificationLabel: string;
    listEmptyLabel?: string;
    inspectorEmptyLabel?: string;
  }
> = {
  not_installed: {
    verificationLabel: UNAVAILABLE_LABEL,
    listEmptyLabel: NOT_INSTALLED_LABEL,
    inspectorEmptyLabel: TOOL_NOT_INSTALLED_LABEL,
  },
  no_profile: {
    verificationLabel: UNAVAILABLE_LABEL,
    listEmptyLabel: NO_PROFILE_LABEL,
    inspectorEmptyLabel: NO_SAVED_PROFILE_YET_LABEL,
  },
  verified: {
    verificationLabel: VERIFIED_IN_THIS_SESSION_LABEL,
  },
  needs_reapply: {
    verificationLabel: NEEDS_REAPPLY_LABEL,
  },
  not_verified: {
    verificationLabel: NOT_VERIFIED_YET_LABEL,
    listEmptyLabel: VERIFICATION_PENDING_LABEL,
    inspectorEmptyLabel: NOT_VERIFIED_YET_LABEL,
  },
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
  return OVERVIEW_HEALTH_METADATA[state].label;
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
  return OVERVIEW_HEALTH_METADATA[state].defaultText;
}

export function overviewHealthSymbol(state: OverviewHealthState) {
  return OVERVIEW_HEALTH_METADATA[state].symbol;
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
  return PROFILE_SWITCH_METADATA[state].tone;
}

export function profileSwitchLabel(state: ProfileSwitchState) {
  return PROFILE_SWITCH_METADATA[state].label;
}

export function profileSwitchSymbol(state: ProfileSwitchState) {
  return PROFILE_SWITCH_METADATA[state].symbol;
}

export function profileLiveMatchLabel(state: ProfileSwitchState) {
  return PROFILE_SWITCH_METADATA[state].liveMatchLabel;
}

export function toolListEmptyLabel(status: ToolStatus) {
  return toolVerificationMetadata(resolveUnverifiedToolState(status)).listEmptyLabel ?? UNAVAILABLE_LABEL;
}

export function toolInspectorEmptyLabel(status: ToolStatus) {
  return (
    toolVerificationMetadata(resolveUnverifiedToolState(status)).inspectorEmptyLabel ??
    UNAVAILABLE_LABEL
  );
}

export function toolVerificationLabel(status: ToolStatus) {
  return toolVerificationMetadata(resolveToolVerificationState(status)).verificationLabel;
}

function toolVerificationMetadata(state: ToolVerificationState) {
  return TOOL_VERIFICATION_METADATA[state];
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
