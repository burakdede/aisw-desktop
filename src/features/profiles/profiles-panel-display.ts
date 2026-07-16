import type {
  AppSnapshot,
  BackupEntry,
  DesktopSettings,
  OAuthProgressEvent,
} from "../../lib/schemas";
import { compareBackupsNewestFirst } from "../../lib/backups";
import { credentialBackendLabel as formatCredentialBackendLabel } from "../../lib/credential-backends";
import { DEFAULT_ACTION_FAILURE_MESSAGE } from "../../lib/display-copy";
import { formatDateTimeWithZone } from "../../lib/date-format";
import { profileLastCheckedLabel } from "../../lib/profile-detail-display";
import { effectiveToolProfileLabel, mergeProfileLabel } from "../../lib/profile-display";
import { toolDisplayName } from "../../lib/tool-display";
import { DesktopCommandError } from "../../lib/tauri";
import { titleCase } from "../../lib/utils";
import {
  resolveProfileSwitchState,
  type ProfileSwitchState,
} from "../../lib/status-display";
import { SUPPORTED_TOOLS, toolShortName, type SupportedTool } from "../../lib/tool-registry";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import type { ProfileCredentialBackend, ProfileImportMode } from "../shared/profile-capabilities";

export type OAuthWizardStep = {
  id: "start" | "browser" | "login" | "capture" | "saved";
  label: string;
  detail: string;
  status: "pending" | "warn" | "pass" | "fail";
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

export const STATIC_STATE_MODE_LABEL = "Isolated";
export const STATIC_STATE_MODE_COPY =
  "Gemini keeps authentication and local state together.";

export const PROFILE_PANEL_COPY = {
  searchAriaLabel: "Search Profiles",
  searchPlaceholder: "Search profiles…",
  filterAriaLabel: "Profile filters",
  addProfileLabel: "Add Profile",
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
  emptyInventoryHeading: "No matching profiles",
  emptyInventoryDetail: "Adjust the tool filter or search query.",
  emptyInspectorHeading: "No profile selected",
  emptyInspectorDetail:
    "Select a saved profile from the table to inspect activation state and storage details.",
  savedAsPrefix: "Saved as ",
  inactiveStorageDetail: "Live storage details are available after this profile becomes active.",
} as const;

export const PROFILE_INSPECTOR_FIELD_LABELS = {
  liveMatch: "Live match",
  authentication: "Authentication",
  credentialStorage: "Credential storage",
  added: "Added",
  lastChecked: "Last checked",
  stateMode: "State mode",
  credentialsPresent: "Credentials present",
  localPermissions: "Local permissions",
  tokenWarning: "Token warning",
  warningPrefix: "Warning",
} as const;

export type InventoryKeyAction =
  | { kind: "move"; direction: "next" | "previous" | "first" | "last" }
  | { kind: "activate" }
  | null;

export function buildProfileSheetDraftReset(
  initialCredentialBackend: ProfileCredentialBackend | null | undefined,
) {
  return {
    credentialBackend: initialCredentialBackend ?? "auto",
    label: "",
    mode: "from_live" as ProfileImportMode,
    profile: "",
  };
}

export function buildProfileInspectAriaLabel(tool: SupportedTool, label: string) {
  return `Inspect ${toolDisplayName(tool)} ${label}`;
}

export function buildProfileRowActionsAriaLabel(tool: SupportedTool, label: string) {
  return `More actions for ${toolDisplayName(tool)} ${label}`;
}

export function buildProfileSavedAsLabel(name: string) {
  return `${PROFILE_PANEL_COPY.savedAsPrefix}${name}`;
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
      const status = input.snapshot.statuses.find((candidate) => candidate.tool === entryTool);
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
          latestBackup
            ? formatDateTimeWithZone(latestBackup.created_at ?? latestBackup.backup_id)
            : null,
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
    [entry.label, entry.name, titleCase(entry.tool), entry.auth, entry.backend, entry.state]
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
  if (!expandedDetails) {
    return null;
  }

  return entries.find((entry) => entry.tool === tool && entry.name === expandedDetails) ?? null;
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
  if (
    input.expandedDetails &&
    input.profiles.some((entry) => entry.name === input.expandedDetails)
  ) {
    return input.expandedDetails;
  }

  return input.activeProfile ?? input.profiles[0]?.name ?? null;
}

export function shouldAutoOpenProfileSheet(input: {
  initialExpandedProfile: string | null | undefined;
  resolvedInitialTool: SupportedTool | null;
  initialMode: string | undefined;
  initialCredentialBackend: string | null | undefined;
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
  mode: "oauth" | "api_key" | "from_env" | "from_live";
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
    ? resolveSelectedProfileSwitchState({
        activeProfile: input.activeProfileName,
        activeProfileApplied: input.activeProfileApplied,
        profileName: selectedName,
      })
    : "stored";
  const hasCustomLabel = Boolean(
    selectedName &&
      input.selectedProfileDisplay &&
      input.selectedProfileDisplay !== titleCase(selectedName),
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
  const profile = input.pendingEdit
    ? input.profiles.find((entry) => entry.name === input.pendingEdit?.name) ?? null
    : null;

  if (!profile) {
    return null;
  }

  const display = effectiveToolProfileLabel(
    input.settings,
    input.tool,
    profile.name,
    profile.label,
  );
  const renameDraft = input.renameDrafts[profile.name] ?? profile.name;
  const labelDraft =
    input.labelDrafts[profile.name] ??
    effectiveToolProfileLabel(input.settings, input.tool, profile.name, profile.label) ??
    "";
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
  const profile = input.pendingRemoval
    ? input.profiles.find((entry) => entry.name === input.pendingRemoval) ?? null
    : null;

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
  availableStateModes: readonly string[];
}) {
  return {
    tool: input.tool,
    profile: input.profileName,
    stateMode: input.availableStateModes.length ? input.selectedStateMode : null,
    label: input.profileLabel,
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

  return {
    runtime_kind: input.settings.runtime_kind,
    runtime_path: input.settings.runtime_path ?? null,
    aisw_home: input.settings.aisw_home ?? null,
    update_channel: input.settings.update_channel,
    profile_sets: input.settings.profile_sets,
    profile_labels: mergeProfileLabel(
      input.settings,
      input.tool,
      input.profileName,
      input.nextLabel || null,
    ),
  };
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
  const definitions = [
    {
      id: "start" as const,
      label: `1. Starting ${toolShortName(tool)} login`,
      fallback: "Preparing the native login flow.",
    },
    {
      id: "browser" as const,
      label: "2. Browser opens",
      fallback: "AI Switch launches the provider login flow.",
    },
    {
      id: "login" as const,
      label: "3. Complete login in browser",
      fallback: "Finish the provider sign-in flow in the browser or terminal window.",
    },
    {
      id: "capture" as const,
      label: "4. Waiting for credential capture",
      fallback: "AI Switch waits for the upstream tool to persist the captured credentials.",
    },
    {
      id: "saved" as const,
      label: "5. Profile saved",
      fallback: "AI Switch stores the captured profile and refreshes app state.",
    },
  ];

  const stageIndex = new Map<OAuthWizardStep["id"], number>(
    definitions.map((definition, index) => [definition.id, index]),
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

    const detail = event.message?.trim() || definitions[index].fallback;
    const failed = stage === "saved" && event.ok === false;
    if (failed) {
      terminalFailure = true;
    }
    seen.set(stage, { detail, failed });
  }

  if (oauthError) {
    highestReached = Math.max(highestReached, definitions.length - 1);
    terminalFailure = true;
  }

  return definitions.map((definition, index) => {
    const explicit = seen.get(definition.id);
    const isFinal = index === definitions.length - 1;
    let status: OAuthWizardStep["status"] = "pending";

    if (terminalFailure && isFinal) {
      status = "fail";
    } else if (highestReached >= index) {
      status = highestReached === index && !isFinal ? "warn" : "pass";
    }

    if (highestReached === definitions.length - 1 && !terminalFailure) {
      status = "pass";
    }

    return {
      id: definition.id,
      label: terminalFailure && isFinal ? "5. OAuth failed" : definition.label,
      detail:
        explicit?.detail ??
        (isFinal && oauthError ? oauthError : definition.fallback),
      status,
    };
  });
}

export function oauthEventStage(event: OAuthProgressEvent): OAuthWizardStep["id"] | null {
  const phase = (event.phase ?? event.type ?? "").toLowerCase();
  switch (phase) {
    case "started":
      return "start";
    case "starting_upstream_auth":
    case "browser_launch":
      return "browser";
    case "waiting_for_user":
    case "waiting_for_login":
      return "login";
    case "applying_changes":
      return "capture";
    case "profile_saved":
    case "result":
      return "saved";
    default:
      return null;
  }
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
  if (error instanceof DesktopCommandError) {
    return error.remediation
      ? `${normalizeRuntimeLanguage(error.message)} Remediation: ${normalizeRuntimeLanguage(error.remediation)}`
      : normalizeRuntimeLanguage(error.message);
  }
  if (error instanceof Error) {
    return normalizeRuntimeLanguage(error.message);
  }
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    const remediation =
      "remediation" in error && typeof error.remediation === "string" ? error.remediation : undefined;
    return remediation
      ? `${normalizeRuntimeLanguage(error.message)} Remediation: ${normalizeRuntimeLanguage(remediation)}`
      : normalizeRuntimeLanguage(error.message);
  }
  return DEFAULT_ACTION_FAILURE_MESSAGE;
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

function resolveSelectedProfileSwitchState(input: {
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
