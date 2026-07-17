import type {
  AppSnapshot,
  BackupEntry,
  DesktopSettings,
  OAuthProgressEvent,
} from "../../lib/schemas";
import { backupTimestampValue, compareBackupsNewestFirst } from "../../lib/backups";
import { credentialBackendLabel as formatCredentialBackendLabel } from "../../lib/credential-backends";
import { buildDesktopSettingsUpdate } from "../../lib/desktop-settings";
import { DESKTOP_ACTION_COPY } from "../../lib/desktop-action-copy";
import {
  LOCAL_PERMISSIONS_LABEL,
  SIGN_IN_FLOW_LABEL,
} from "../../lib/desktop-domain-copy";
import {
  BACK_LABEL,
  CANCEL_LABEL,
  DEFAULT_ACTION_FAILURE_MESSAGE,
  inspectItemLabel,
  moreActionsLabel,
  noSelectionHeading,
  quotedActionHeading,
} from "../../lib/display-copy";
import { resolveErrorDetails } from "../../lib/error-details";
import { formatDateTimeWithZone } from "../../lib/date-format";
import { profileLastCheckedLabel } from "../../lib/profile-detail-display";
import {
  effectiveToolProfileLabel,
  findSnapshotToolStatus,
  hasCustomProfileLabel,
  mergeProfileLabel,
} from "../../lib/profile-display";
import { formatMessageWithRemediation } from "../../lib/remediation-text";
import { toolDisplayName } from "../../lib/tool-display";
import {
  findMatchingItem,
  hasMatchingSelection,
  resolveSelectionValue,
  stringRecordValue,
  trimmedStringOrNull,
} from "../../lib/utils";
import { normalizeOneOf } from "../../lib/parse-guards";
import {
  resolveProfileSwitchState,
  type ProfileSwitchState,
} from "../../lib/status-display";
import { SUPPORTED_TOOLS, toolShortName, type SupportedTool } from "../../lib/tool-registry";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import {
  PROFILE_CREDENTIAL_BACKENDS,
  PROFILE_IMPORT_MODES,
  DEFAULT_PROFILE_CREDENTIAL_BACKEND,
  DEFAULT_PROFILE_IMPORT_MODE,
  resolveCredentialBackendRequest,
  type ExplicitProfileCredentialBackend,
  type ProfileCredentialBackend,
  type ProfileImportMode,
} from "../shared/profile-capabilities";
import {
  DEFAULT_EDITABLE_STATE_MODE,
  resolvePreferredEditableStateMode,
  stateModeLabel,
  type EditableStateMode,
} from "../shared/state-modes";

export type OAuthWizardStep = {
  id: "start" | "browser" | "login" | "capture" | "saved";
  label: string;
  detail: string;
  status: "pending" | "warn" | "pass" | "fail";
};

type OAuthWizardStepDefinition = {
  id: OAuthWizardStep["id"];
  label: string | ((tool: string) => string);
  fallback: string;
};

type ProfileEntry = {
  name: string;
  label?: string | null;
};

type PendingEditState = {
  name: string;
  focus: "name" | "label";
} | null;

export type ProfileActionMenuItem = {
  kind: "activate" | "reapply" | "rename" | "change_label" | "view_backups" | "remove";
  label: string;
  disabled?: boolean;
  danger?: boolean;
};

export const INVENTORY_FILTERS = ["all", ...SUPPORTED_TOOLS] as const;

export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

export type InventoryEntry = {
  tool: SupportedTool;
  name: string;
  auth: string;
  label: string;
  active: boolean;
  backend: string;
  state: ProfileSwitchState;
  lastChecked: string;
  hasBackup: boolean;
};

export type ProfileActionScope = "inspector" | "table";
export type ProfileActionTarget = {
  tool: SupportedTool;
  name: string;
};

export type OpenProfileActionMenu = {
  tool: SupportedTool;
  name: string;
  scope: ProfileActionScope;
} | null;

export const STATIC_STATE_MODE_LABEL = stateModeLabel(DEFAULT_EDITABLE_STATE_MODE);
export const STATIC_STATE_MODE_COPY =
  "Gemini keeps authentication and local state together.";

export const PROFILE_PANEL_COPY = {
  searchAriaLabel: "Search Profiles",
  searchPlaceholder: "Search profiles…",
  filterAriaLabel: "Profile filters",
  addProfileLabel: DESKTOP_ACTION_COPY.addProfileLabel,
  tableAriaLabel: "Profile table",
  listAriaLabel: "Profiles",
  tableColumns: [
    { label: "Name", className: undefined },
    { label: "Tool", className: undefined },
    { label: "Status", className: undefined },
    { label: "Authentication", className: "profiles-table-column-auth" },
    { label: "Backend", className: "profiles-table-column-low" },
    { label: "Last checked", className: "profiles-table-column-low" },
  ],
  actionMenuAriaLabel: "Profile actions",
  inspectorTriggerAriaLabel: "More profile actions",
  backLabel: BACK_LABEL,
  emptyInventoryHeading: "No matching profiles",
  emptyInventoryDetail: "Adjust the tool filter or search query.",
  emptyInspectorHeading: noSelectionHeading("profile"),
  emptyInspectorDetail:
    "Select a saved profile from the table to inspect activation state and storage details.",
  savedAsPrefix: "Saved as ",
  inactiveStorageDetail: "Live storage details are available after this profile becomes active.",
} as const;

export const PROFILE_EDIT_SHEET_COPY = {
  ariaLabel: "Edit Profile",
  kicker: "Profile",
  heading: "Rename Profile",
  currentNameLabel: "Current name",
  newNameLabel: "New name",
  displayLabelLabel: "Display label",
  cancelLabel: CANCEL_LABEL,
  saveLabel: "Save",
} as const;

export const PROFILE_REMOVAL_SHEET_COPY = {
  ariaLabel: "Remove Profile",
  kicker: "Removal",
  warning:
    "AI Switch creates a backup before removal. Current live credentials are not removed automatically.",
  cancelLabel: CANCEL_LABEL,
  confirmLabel: "Remove Profile",
} as const;

export const PROFILE_ADD_SHEET_COPY = {
  heading: "Add a saved login",
  toolLabel: "Tool",
  profileNameLabel: "Profile name",
  displayLabelLabel: "Display label",
  authenticationLabel: "Authentication",
  importModeAriaLabel: "Import mode",
  modeKicker: "Mode",
  credentialBackendLabel: "Credential backend",
  apiKeyLabel: "API key",
  expectedEnvVarPrefix: "Expected environment variable:",
  oauthFlowHeading: SIGN_IN_FLOW_LABEL,
  oauthFlowPrimaryNote:
    "AI Switch will launch the tool's native login flow and stream progress from the included desktop engine.",
  oauthFlowSecondaryNote:
    "Keep this window open while the browser or terminal login completes.",
  oauthProgressHeading: "OAuth progress",
  oauthProgressEmptyNote:
    "Start OAuth to stream each login step before the profile is captured and saved.",
  cancelLabel: CANCEL_LABEL,
} as const;

export const PROFILE_INSPECTOR_FIELD_LABELS = {
  liveMatch: "Live match",
  authentication: "Authentication",
  credentialStorage: "Credential storage",
  added: "Added",
  lastChecked: "Last checked",
  stateMode: "State mode",
  credentialsPresent: "Credentials present",
  localPermissions: LOCAL_PERMISSIONS_LABEL,
  tokenWarning: "Token warning",
  warningPrefix: "Warning",
} as const;

const OAUTH_WIZARD_FAILURE_LABEL = "5. OAuth failed";

const OAUTH_WIZARD_STEP_DEFINITIONS: readonly OAuthWizardStepDefinition[] = [
  {
    id: "start",
    label: (tool) => `1. Starting ${toolShortName(tool)} login`,
    fallback: "Preparing the native login flow.",
  },
  {
    id: "browser",
    label: "2. Browser opens",
    fallback: "AI Switch launches the provider login flow.",
  },
  {
    id: "login",
    label: "3. Complete login in browser",
    fallback: "Finish the provider sign-in flow in the browser or terminal window.",
  },
  {
    id: "capture",
    label: "4. Waiting for credential capture",
    fallback: "AI Switch waits for the upstream tool to persist the captured credentials.",
  },
  {
    id: "saved",
    label: "5. Profile saved",
    fallback: "AI Switch stores the captured profile and refreshes app state.",
  },
] as const;

const OAUTH_EVENT_PHASE_STAGE_MAP = {
  started: "start",
  starting_upstream_auth: "browser",
  browser_launch: "browser",
  waiting_for_user: "login",
  waiting_for_login: "login",
  applying_changes: "capture",
  profile_saved: "saved",
  result: "saved",
} as const satisfies Record<string, OAuthWizardStep["id"]>;

export type InventoryKeyAction =
  | { kind: "move"; direction: "next" | "previous" | "first" | "last" }
  | { kind: "activate" }
  | null;

export function buildProfileSheetDraftReset(
  initialCredentialBackend: ProfileCredentialBackend | null | undefined,
) {
  return {
    credentialBackend: initialProfileSheetCredentialBackend(initialCredentialBackend),
    label: "",
    mode: initialProfileSheetImportMode(),
    profile: "",
  };
}

export function initialProfileSheetImportMode(
  initialMode?: ProfileImportMode,
): ProfileImportMode {
  return initialMode ?? DEFAULT_PROFILE_IMPORT_MODE;
}

export function initialProfileSheetCredentialBackend(
  initialCredentialBackend: ProfileCredentialBackend | null | undefined,
): ProfileCredentialBackend {
  return initialCredentialBackend ?? DEFAULT_PROFILE_CREDENTIAL_BACKEND;
}

export function buildProfileInspectAriaLabel(tool: SupportedTool, label: string) {
  return inspectItemLabel(`${toolDisplayName(tool)} ${label}`);
}

export function buildProfileRowActionsAriaLabel(tool: SupportedTool, label: string) {
  return moreActionsLabel(`${toolDisplayName(tool)} ${label}`);
}

export function buildProfileSavedAsLabel(name: string) {
  return `${PROFILE_PANEL_COPY.savedAsPrefix}${name}`;
}

export function buildProfileRemovalHeading(label: string) {
  return quotedActionHeading("Remove", label);
}

export function buildProfileFileBackendNote(tool: SupportedTool) {
  return `${toolShortName(tool)} profiles are always stored with file-backed credentials.`;
}

export function normalizeInventoryFilter(
  value: unknown,
  fallback: InventoryFilter = INVENTORY_FILTERS[0],
): InventoryFilter {
  return normalizeOneOf(INVENTORY_FILTERS, value, fallback);
}

export function normalizeProfileSheetTool(
  value: unknown,
  fallback: SupportedTool = SUPPORTED_TOOLS[0],
): SupportedTool {
  return normalizeOneOf(SUPPORTED_TOOLS, value, fallback);
}

export function normalizeProfileSheetImportMode(
  value: unknown,
  availableModes: readonly ProfileImportMode[],
  fallback: ProfileImportMode = DEFAULT_PROFILE_IMPORT_MODE,
): ProfileImportMode {
  return resolveAvailableSelection(
    normalizeOneOf(PROFILE_IMPORT_MODES, value, fallback),
    availableModes,
    fallback,
  );
}

export function normalizeProfileSheetCredentialBackend(
  value: unknown,
  availableBackends: readonly ProfileCredentialBackend[],
  fallback: ProfileCredentialBackend = DEFAULT_PROFILE_CREDENTIAL_BACKEND,
): ProfileCredentialBackend {
  return resolveAvailableSelection(
    normalizeOneOf(PROFILE_CREDENTIAL_BACKENDS, value, fallback),
    availableBackends,
    fallback,
  );
}

export function buildInventoryProfiles(input: {
  backups: BackupEntry[] | undefined;
  inventoryFilter: InventoryFilter;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
}) {
  const toolEntries = input.inventoryFilter === "all" ? SUPPORTED_TOOLS : [input.inventoryFilter];

  return toolEntries.flatMap((entryTool) =>
    (input.snapshot.profiles[entryTool]?.profiles ?? []).map<InventoryEntry>((entry) => {
      const status = findSnapshotToolStatus(input.snapshot, entryTool);
      const latestBackup = latestBackupForProfile(entryTool, entry.name, input.backups);
      const isActive = input.snapshot.profiles[entryTool]?.active === entry.name;

      return {
        tool: entryTool,
        name: entry.name,
        auth: entry.auth,
        label: effectiveToolProfileLabel(input.settings, entryTool, entry.name, entry.label),
        active: isActive,
        backend: formatCredentialBackendLabel(status?.credential_backend, "inventory"),
        state: resolveProfileSwitchState({
          activeProfile: input.snapshot.profiles[entryTool]?.active,
          profileName: entry.name,
          activeProfileApplied: status?.active_profile_applied,
        }),
        lastChecked: profileLastCheckedLabel(
          latestBackup ? formatDateTimeWithZone(backupTimestampValue(latestBackup)) : null,
          isActive,
        ),
        hasBackup: Boolean(latestBackup),
      };
    }),
  );
}

export function filterInventoryProfiles(entries: InventoryEntry[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return entries;
  }

  return entries.filter((entry) =>
    [entry.label, entry.name, toolDisplayName(entry.tool), entry.auth, entry.backend, entry.state]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

export function findSelectedInventoryEntry(
  entries: InventoryEntry[],
  tool: SupportedTool,
  expandedDetails: string | null,
) {
  return findMatchingItem(
    expandedDetails ? `${tool}:${expandedDetails}` : null,
    entries,
    (entry) => `${entry.tool}:${entry.name}`,
  );
}

export function resolveAvailableSelection<T extends string>(
  currentValue: T,
  availableValues: readonly T[],
  fallbackValue: T,
) {
  if (availableValues.includes(currentValue)) {
    return currentValue;
  }
  return availableValues[0] ?? fallbackValue;
}

export function defaultExpandedProfileName(input: {
  expandedDetails: string | null;
  activeProfile: string | null | undefined;
  profiles: ProfileEntry[];
}) {
  if (hasMatchingSelection(input.expandedDetails, input.profiles, (entry) => entry.name)) {
    return input.expandedDetails;
  }

  return resolveSelectionValue(input.activeProfile, input.profiles, (entry) => entry.name);
}

export function shouldAutoOpenProfileSheet(input: {
  initialExpandedProfile: string | null | undefined;
  resolvedInitialTool: SupportedTool | null;
  initialMode: ProfileImportMode | undefined;
  initialCredentialBackend: ExplicitProfileCredentialBackend | null | undefined;
  openToken: number | undefined;
}) {
  return (
    input.initialExpandedProfile == null &&
    (Boolean(input.resolvedInitialTool) ||
      Boolean(input.initialMode) ||
      Boolean(input.initialCredentialBackend) ||
      input.openToken != null)
  );
}

export function toggleProfileActionMenu(
  current: OpenProfileActionMenu,
  next: Exclude<OpenProfileActionMenu, null>,
) {
  return current?.tool === next.tool &&
    current?.name === next.name &&
    current.scope === next.scope
    ? null
    : next;
}

export function inventoryKeyActionForEvent(key: string, metaKey: boolean, altKey: boolean) {
  if (altKey) {
    return null;
  }

  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", direction: "next" } satisfies InventoryKeyAction;
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", direction: "previous" } satisfies InventoryKeyAction;
    case "Home":
      return { kind: "move", direction: "first" } satisfies InventoryKeyAction;
    case "End":
      return { kind: "move", direction: "last" } satisfies InventoryKeyAction;
    case "Enter":
      return metaKey ? ({ kind: "activate" } satisfies InventoryKeyAction) : null;
    default:
      return null;
  }
}

export function nextInventorySelectionIndex(
  currentIndex: number,
  totalEntries: number,
  direction: "next" | "previous" | "first" | "last",
) {
  if (totalEntries <= 0) {
    return null;
  }

  switch (direction) {
    case "first":
      return 0;
    case "last":
      return totalEntries - 1;
    case "next":
      return Math.max(0, Math.min(currentIndex + 1, totalEntries - 1));
    case "previous":
      return Math.max(0, Math.min(currentIndex - 1, totalEntries - 1));
  }
}

export function buildProfileSheetSubmitLabel(input: {
  mode: ProfileImportMode;
  addProfilePending: boolean;
  addProfileOAuthPending: boolean;
  apiKeyPending: boolean;
}) {
  if (input.mode === "oauth") {
    return input.addProfileOAuthPending ? "Waiting for sign-in…" : "Start Sign In";
  }
  if (input.mode === "api_key") {
    return input.apiKeyPending ? "Saving…" : "Save Profile";
  }
  if (input.mode === "from_env") {
    return input.addProfilePending ? "Saving…" : "Save Profile";
  }
  return input.addProfilePending ? "Importing…" : "Import";
}

export function buildProfileActionMenu(input: {
  active: boolean;
  hasBackup: boolean;
  scope: "table" | "inspector";
  state: ProfileSwitchState;
}) {
  const actions: ProfileActionMenuItem[] = [];

  if (input.scope === "table" && !input.active) {
    actions.push({ kind: "activate", label: "Activate" });
  }
  if (input.scope === "table" && input.state === "live_mismatch") {
    actions.push({ kind: "reapply", label: "Reapply Active Profile" });
  }

  actions.push({ kind: "rename", label: "Rename…" });
  actions.push({ kind: "change_label", label: "Change Label…" });
  actions.push({
    kind: "view_backups",
    label: "View Backups",
    disabled: !input.hasBackup,
  });
  actions.push({
    kind: "remove",
    label: "Remove…",
    danger: true,
  });

  return actions;
}

export function buildSelectedProfileInspectorState(input: {
  activeProfileApplied: boolean | null | undefined;
  activeProfileName: string | null | undefined;
  selectedProfileDisplay: string | null;
  selectedProfileName: string | null;
}) {
  const selectedName = input.selectedProfileName;
  const isActive = Boolean(
    selectedName && input.activeProfileName === selectedName,
  );
  const state: ProfileSwitchState = selectedName
    ? resolveProfileSwitchState({
        activeProfile: input.activeProfileName,
        activeProfileApplied: input.activeProfileApplied,
        profileName: selectedName,
      })
    : "stored";
  const hasCustomLabel = hasCustomProfileLabel(
    selectedName,
    input.selectedProfileDisplay,
  );
  const canActivate = Boolean(selectedName && !isActive);
  const needsReapply = Boolean(
    selectedName && isActive && input.activeProfileApplied === false,
  );

  return {
    canActivate,
    hasCustomLabel,
    isActive,
    needsReapply,
    primaryActionLabel: canActivate
      ? "Activate Profile"
      : needsReapply
        ? `Reapply ${input.selectedProfileDisplay}`
        : null,
    state,
  };
}

export function buildProfileEditSheetState(input: {
  pendingEdit: PendingEditState;
  profiles: ProfileEntry[];
  settings: DesktopSettings;
  tool: SupportedTool;
  renameDrafts: Record<string, string>;
  labelDrafts: Record<string, string>;
}) {
  const profile = findMatchingItem(input.pendingEdit?.name, input.profiles, (entry) => entry.name);

  if (!profile) {
    return null;
  }

  const display = effectiveToolProfileLabel(
    input.settings,
    input.tool,
    profile.name,
    profile.label,
  );
  const renameDraft = stringRecordValue(input.renameDrafts, profile.name, profile.name);
  const labelDraft = stringRecordValue(
    input.labelDrafts,
    profile.name,
    effectiveToolProfileLabel(input.settings, input.tool, profile.name, profile.label),
  );
  const renameDuplicate =
    renameDraft.trim().length > 0 &&
    isDuplicateProfileName(input.profiles, profile.name, renameDraft);

  return {
    display,
    labelDraft,
    profile,
    renameDraft,
    renameDuplicate,
  };
}

export function buildProfileRemovalSheetState(input: {
  pendingRemoval: string | null;
  profiles: ProfileEntry[];
  settings: DesktopSettings;
  tool: SupportedTool;
}) {
  const profile = findMatchingItem(input.pendingRemoval, input.profiles, (entry) => entry.name);

  if (!profile) {
    return null;
  }

  return {
    display: effectiveToolProfileLabel(
      input.settings,
      input.tool,
      profile.name,
      profile.label,
    ),
    profile,
  };
}

export function buildProfileActivationRequest(input: {
  tool: SupportedTool;
  profileName: string;
  profileLabel: string;
  selectedStateMode: string;
  availableStateModes: readonly EditableStateMode[];
}) {
  return {
    tool: input.tool,
    profile: input.profileName,
    stateMode: resolvePreferredEditableStateMode(input.availableStateModes, input.selectedStateMode),
    label: input.profileLabel,
  };
}

export function buildProfileMutationRequest(input: {
  tool: SupportedTool;
  profileName: string;
  profileLabel: string;
  selectedStateMode: string;
  availableStateModes: readonly EditableStateMode[];
  credentialBackend: ProfileCredentialBackend;
}) {
  return {
    tool: input.tool,
    profile: input.profileName,
    label: trimmedStringOrNull(input.profileLabel),
    stateMode: resolvePreferredEditableStateMode(input.availableStateModes, input.selectedStateMode),
    credentialBackend: resolveCredentialBackendRequest(input.credentialBackend),
  };
}

export function buildProfileLabelUpdateRequest(input: {
  settings: DesktopSettings;
  tool: SupportedTool;
  profileName: string;
  profileLabel: string | null | undefined;
  nextLabel: string;
}) {
  const currentLabel = effectiveToolProfileLabel(
    input.settings,
    input.tool,
    input.profileName,
    input.profileLabel ?? null,
  );
  if (input.nextLabel === currentLabel) {
    return null;
  }

  return buildDesktopSettingsUpdate(input.settings, {
    profile_labels: mergeProfileLabel(
      input.settings,
      input.tool,
      input.profileName,
      trimmedStringOrNull(input.nextLabel),
    ),
  });
}

export function latestBackupForProfile(
  tool: string,
  profile: string,
  backups: BackupEntry[] | undefined,
) {
  return [...(backups ?? [])]
    .filter(
      (entry) =>
        entry.tool === tool &&
        (entry.profile === profile || entry.profile === `${tool}/${profile}`),
    )
    .sort(compareBackupsNewestFirst)[0];
}

export function buildOauthWizardSteps(
  tool: string,
  events: OAuthProgressEvent[],
  oauthError: string,
): OAuthWizardStep[] {
  const stageIndex = new Map<OAuthWizardStep["id"], number>(
    OAUTH_WIZARD_STEP_DEFINITIONS.map((definition, index) => [definition.id, index]),
  );
  const seen = new Map<OAuthWizardStep["id"], { detail: string; failed: boolean }>();
  let highestReached = -1;
  let terminalFailure = false;

  for (const event of events) {
    const stage = oauthEventStage(event);
    if (!stage) {
      continue;
    }

    const index = stageIndex.get(stage) ?? -1;
    if (index > highestReached) {
      highestReached = index;
    }

    const detail = event.message?.trim() || OAUTH_WIZARD_STEP_DEFINITIONS[index].fallback;
    const failed = stage === "saved" && event.ok === false;
    if (failed) {
      terminalFailure = true;
    }
    seen.set(stage, { detail, failed });
  }

  if (oauthError) {
    highestReached = Math.max(highestReached, OAUTH_WIZARD_STEP_DEFINITIONS.length - 1);
    terminalFailure = true;
  }

  return OAUTH_WIZARD_STEP_DEFINITIONS.map((definition, index) => {
    const explicit = seen.get(definition.id);
    const isFinal = index === OAUTH_WIZARD_STEP_DEFINITIONS.length - 1;
    let status: OAuthWizardStep["status"] = "pending";

    if (terminalFailure && isFinal) {
      status = "fail";
    } else if (highestReached >= index) {
      status = highestReached === index && !isFinal ? "warn" : "pass";
    }

    if (highestReached === OAUTH_WIZARD_STEP_DEFINITIONS.length - 1 && !terminalFailure) {
      status = "pass";
    }

    return {
      id: definition.id,
      label:
        terminalFailure && isFinal
          ? OAUTH_WIZARD_FAILURE_LABEL
          : typeof definition.label === "function"
            ? definition.label(tool)
            : definition.label,
      detail:
        explicit?.detail ??
        (isFinal && oauthError ? oauthError : definition.fallback),
      status,
    };
  });
}

export function oauthEventStage(event: OAuthProgressEvent): OAuthWizardStep["id"] | null {
  const phase = (event.phase ?? event.type ?? "").toLowerCase();
  return OAUTH_EVENT_PHASE_STAGE_MAP[phase as keyof typeof OAUTH_EVENT_PHASE_STAGE_MAP] ?? null;
}

export function profileMutationError(...errors: Array<unknown>) {
  for (const error of errors) {
    if (error) {
      return formatDesktopError(error);
    }
  }
  return "";
}

export function formatDesktopError(error: unknown) {
  const details = resolveErrorDetails(error, DEFAULT_ACTION_FAILURE_MESSAGE);
  return formatMessageWithRemediation(
    normalizeRuntimeLanguage(details.message),
    details.remediation
      ? normalizeRuntimeLanguage(details.remediation)
      : undefined,
  );
}

export function isDuplicateProfileName(
  profiles: ProfileEntry[],
  currentName: string,
  nextName: string,
) {
  const normalizedCurrent = currentName.trim().toLowerCase();
  const normalizedNext = nextName.trim().toLowerCase();
  return profiles.some(
    (entry) =>
      entry.name.trim().toLowerCase() === normalizedNext &&
      entry.name.trim().toLowerCase() !== normalizedCurrent,
  );
}
