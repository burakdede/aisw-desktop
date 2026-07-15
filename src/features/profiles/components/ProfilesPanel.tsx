import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SearchField } from "../../../components/SearchField";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactLayout } from "../../../components/useCompactLayout";
import {
  AppBootstrap,
  AppSnapshot,
  DesktopSettings,
  type OAuthProgressEvent,
} from "../../../lib/schemas";
import { compareBackupsNewestFirst } from "../../../lib/backups";
import { DATE_UNAVAILABLE_LABEL, formatDateTimeWithZone } from "../../../lib/date-format";
import {
  BACKEND_UNAVAILABLE_LABEL,
  DEFAULT_ACTION_FAILURE_MESSAGE,
  NOT_AVAILABLE_LABEL,
  VERIFICATION_REQUIRED_LABEL,
} from "../../../lib/display-copy";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import {
  profileLiveMatchLabel,
  profileSwitchLabel,
  profileSwitchSymbol,
  profileSwitchTone,
  resolveProfileSwitchState,
  type ProfileSwitchState,
} from "../../../lib/status-display";
import { DesktopCommandError } from "../../../lib/tauri";
import { listenDesktopEvent } from "../../../lib/tauri";
import { listBackups, parseOAuthProgressEvent } from "../../../lib/client";
import {
  SUPPORTED_TOOLS,
  toolApiKeyEnvVar,
  toolShortName,
  type SupportedTool,
} from "../../../lib/tool-registry";
import { toolDisplayName } from "../../../lib/tool-display";
import { titleCase } from "../../../lib/utils";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import {
  resolveCredentialBackendRequest,
  supportedCredentialBackends,
  supportedProfileImportModes,
  type ProfileCredentialBackend,
  type ProfileImportMode,
} from "../../shared/profile-capabilities";
import { supportedStateModes } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { StateModeField } from "../../shared/components/StateModeField";

const TOOLS = SUPPORTED_TOOLS;
const INVENTORY_FILTERS = ["all", ...TOOLS] as const;

type InventoryFilter = (typeof INVENTORY_FILTERS)[number];
type InventoryEntry = {
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

export function ProfilesPanel({
  snapshot,
  settings,
  toolCapabilities,
  initialTool,
  initialExpandedProfile,
  initialMode,
  initialCredentialBackend,
  openToken,
  onOpenBackups,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  initialTool?: string;
  initialExpandedProfile?: string | null;
  initialMode?: ProfileImportMode;
  initialCredentialBackend?: "file" | "system-keyring" | null;
  openToken?: number;
  onOpenBackups?: () => void;
}) {
  const {
    addProfileMutation,
    addProfileOAuthMutation,
    useProfileMutation,
    renameProfileMutation,
    removeProfileMutation,
    updateSettingsMutation,
    apiKeyProfileAction,
    mutationLock,
  } = useDesktopActions();
  const [tool, setTool] = useState<SupportedTool>(
    isSupportedTool(initialTool) ? initialTool : "claude",
  );
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>(
    isSupportedTool(initialTool) ? initialTool : "all",
  );
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<ProfileImportMode>(
    initialMode ?? "from_live",
  );
  const [credentialBackend, setCredentialBackend] = useState<ProfileCredentialBackend>(
    initialCredentialBackend ?? "auto",
  );
  const [stateMode, setStateMode] = useState("isolated");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [oauthEvents, setOauthEvents] = useState<OAuthProgressEvent[]>([]);
  const [oauthError, setOauthError] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{
    name: string;
    focus: "name" | "label";
  } | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [openStorageDetails, setOpenStorageDetails] = useState<string | null>(null);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [openRowActions, setOpenRowActions] = useState<{
    tool: SupportedTool;
    name: string;
    scope: "inspector" | "table";
  } | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const editLabelInputRef = useRef<HTMLInputElement | null>(null);
  const inspectorMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const inventoryRowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rowActionAnchorRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compactLayout = useCompactLayout(rootRef, PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);

  const profiles = useMemo(() => snapshot.profiles[tool]?.profiles ?? [], [snapshot, tool]);
  const readEnabled = useMutationAwareQueryEnabled();
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups, enabled: readEnabled });
  const inventoryProfiles = useMemo(() => {
    const toolEntries =
      inventoryFilter === "all" ? TOOLS : [inventoryFilter];

    return toolEntries.flatMap((entryTool) =>
      (snapshot.profiles[entryTool]?.profiles ?? []).map<InventoryEntry>((entry) => {
        const status = snapshot.statuses.find((candidate) => candidate.tool === entryTool);
        const latestBackup = latestBackupForProfile(entryTool, entry.name, backups.data);
        return {
          tool: entryTool,
          name: entry.name,
          auth: entry.auth,
          label: effectiveLabel(entryTool, entry.name, entry.label, settings) ?? titleCase(entry.name),
          active: snapshot.profiles[entryTool]?.active === entry.name,
          backend: status?.credential_backend ? formatBackendLabel(status.credential_backend) : BACKEND_UNAVAILABLE_LABEL,
          state: resolveProfileSwitchState({
            activeProfile: snapshot.profiles[entryTool]?.active,
            profileName: entry.name,
            activeProfileApplied: status?.active_profile_applied,
          }),
          lastChecked: latestBackup
            ? formatBackupTimestamp(latestBackup.created_at ?? latestBackup.backup_id)
            : snapshot.profiles[entryTool]?.active === entry.name
              ? "Not Verified"
              : DATE_UNAVAILABLE_LABEL,
          hasBackup: Boolean(latestBackup),
        };
      }),
    );
  }, [backups.data, inventoryFilter, settings, snapshot]);
  const filteredInventoryProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return inventoryProfiles;
    }
    return inventoryProfiles.filter((entry) =>
      [entry.label, entry.name, titleCase(entry.tool), entry.auth, entry.backend, entry.state]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [inventoryProfiles, search]);
  const normalizedProfileNames = useMemo(
    () => new Set(profiles.map((entry) => entry.name.trim().toLowerCase())),
    [profiles],
  );
  const toolStatus = useMemo(
    () => snapshot.statuses.find((entry) => entry.tool === tool),
    [snapshot.statuses, tool],
  );
  const availableStateModes = useMemo(
    () => supportedStateModes(tool, toolCapabilities),
    [tool, toolCapabilities],
  );
  const availableCredentialBackends = useMemo(
    () => supportedCredentialBackends(tool, toolCapabilities),
    [tool, toolCapabilities],
  );
  const availableImportModes = useMemo(
    () => supportedProfileImportModes(tool, toolCapabilities),
    [tool, toolCapabilities],
  );
  const duplicateDraftName = profile.trim();
  const hasDuplicateProfileName =
    duplicateDraftName.length > 0 && normalizedProfileNames.has(duplicateDraftName.toLowerCase());
  const oauthWizardSteps = useMemo(
    () => buildOauthWizardSteps(tool, oauthEvents, oauthError),
    [tool, oauthEvents, oauthError],
  );
  const selectedInventoryEntry = useMemo(() => {
    if (!expandedDetails) {
      return null;
    }
    return inventoryProfiles.find((entry) => entry.tool === tool && entry.name === expandedDetails) ?? null;
  }, [expandedDetails, inventoryProfiles, tool]);
  const selectedProfileEntry = useMemo(
    () => profiles.find((entry) => entry.name === expandedDetails) ?? null,
    [expandedDetails, profiles],
  );
  const selectedProfileDisplay = useMemo(
    () =>
      selectedProfileEntry
        ? effectiveLabel(tool, selectedProfileEntry.name, selectedProfileEntry.label, settings) ??
          titleCase(selectedProfileEntry.name)
        : null,
    [selectedProfileEntry, settings, tool],
  );
  const selectedLatestBackup = useMemo(
    () =>
      selectedProfileEntry
        ? latestBackupForProfile(tool, selectedProfileEntry.name, backups.data)
        : undefined,
    [backups.data, selectedProfileEntry, tool],
  );
  const selectedHasCustomLabel = Boolean(
    selectedProfileEntry &&
      selectedProfileDisplay &&
      selectedProfileDisplay !== titleCase(selectedProfileEntry.name),
  );
  const selectedIsActive = Boolean(
    selectedProfileEntry && snapshot.profiles[tool]?.active === selectedProfileEntry.name,
  );
  const selectedProfileState = selectedProfileEntry
    ? resolveProfileSwitchState({
        activeProfile: snapshot.profiles[tool]?.active,
        profileName: selectedProfileEntry.name,
        activeProfileApplied: toolStatus?.active_profile_applied,
      })
    : "stored";
  const selectedProfileCanActivate = Boolean(selectedProfileEntry && !selectedIsActive);
  const selectedProfileNeedsReapply = Boolean(
    selectedProfileEntry && selectedIsActive && toolStatus?.active_profile_applied === false,
  );
  const editSheetProfile = pendingEdit
    ? profiles.find((entry) => entry.name === pendingEdit.name) ?? null
    : null;
  const editSheetDisplay = editSheetProfile
    ? effectiveLabel(tool, editSheetProfile.name, editSheetProfile.label, settings) ?? titleCase(editSheetProfile.name)
    : null;
  const editSheetRenameDraft = editSheetProfile ? renameDrafts[editSheetProfile.name] ?? editSheetProfile.name : "";
  const editSheetLabelDraft = editSheetProfile
    ? labelDrafts[editSheetProfile.name] ??
      effectiveLabel(tool, editSheetProfile.name, editSheetProfile.label, settings) ??
      ""
    : "";
  const editSheetRenameDuplicate =
    editSheetProfile &&
    editSheetRenameDraft.trim().length > 0 &&
    isDuplicateProfileName(profiles, editSheetProfile.name, editSheetRenameDraft);
  const removalSheetProfile = pendingRemoval
    ? profiles.find((entry) => entry.name === pendingRemoval) ?? null
    : null;
  const removalSheetDisplay = removalSheetProfile
    ? effectiveLabel(tool, removalSheetProfile.name, removalSheetProfile.label, settings) ??
      titleCase(removalSheetProfile.name)
    : null;

  useEffect(() => {
    if (!availableStateModes.length) {
      return;
    }
    if (!availableStateModes.includes(stateMode)) {
      setStateMode(availableStateModes[0]);
    }
  }, [availableStateModes, stateMode]);

  useEffect(() => {
    if (!isSupportedTool(initialTool)) {
      return;
    }
    setTool(initialTool);
    setInventoryFilter(initialTool);
  }, [initialTool]);

  useEffect(() => {
    if (!initialMode) {
      return;
    }
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (availableImportModes.includes(mode)) {
      return;
    }
    setMode(availableImportModes[0] ?? "from_live");
  }, [availableImportModes, mode]);

  useEffect(() => {
    const next = initialCredentialBackend ?? "auto";
    setCredentialBackend(next);
  }, [initialCredentialBackend]);

  useEffect(() => {
    if (availableCredentialBackends.includes(credentialBackend)) {
      return;
    }
    setCredentialBackend(availableCredentialBackends[0] ?? "auto");
  }, [availableCredentialBackends, credentialBackend]);

  useEffect(() => {
    setExpandedDetails(initialExpandedProfile ?? null);
    setOpenStorageDetails(null);
  }, [initialExpandedProfile, initialTool]);

  useEffect(() => {
    if (
      initialExpandedProfile == null &&
      (isSupportedTool(initialTool) ||
        Boolean(initialMode) ||
        Boolean(initialCredentialBackend) ||
        openToken != null)
    ) {
      setProfileSheetOpen(true);
    }
  }, [initialCredentialBackend, initialExpandedProfile, initialMode, initialTool, openToken]);

  useEffect(() => {
    if (inventoryFilter === "all") {
      return;
    }
    setTool(inventoryFilter);
  }, [inventoryFilter]);

  useEffect(() => {
    if (expandedDetails && profiles.some((entry) => entry.name === expandedDetails)) {
      return;
    }
    const nextDefault = snapshot.profiles[tool]?.active ?? profiles[0]?.name ?? null;
    if (nextDefault !== expandedDetails) {
      setExpandedDetails(nextDefault);
    }
  }, [expandedDetails, profiles, snapshot.profiles, tool]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenDesktopEvent<unknown>("oauth-progress", (payload) => {
      if (!active) return;
      const event = parseOAuthProgressEvent(payload);
      setOauthEvents((current) => [...current, event]);
    }).then((dispose) => {
      unlisten = typeof dispose === "function" ? dispose : undefined;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!openRowActions) {
      return;
    }

    function closeActions(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-profile-row-actions]")) {
        return;
      }
      setOpenRowActions(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenRowActions(null);
      }
    }

    document.addEventListener("mousedown", closeActions);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeActions);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openRowActions]);

  useEffect(() => {
    if (!pendingEdit) {
      return;
    }
    const target = pendingEdit.focus === "label" ? editLabelInputRef.current : renameInputRef.current;
    target?.focus();
    target?.select();
  }, [pendingEdit]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.trim() || hasDuplicateProfileName) {
      return;
    }

    const nextStateMode = availableStateModes.length ? stateMode : null;

    if (mode === "oauth") {
      setOauthEvents([]);
      setOauthError("");
      addProfileOAuthMutation.mutate(
        {
          tool,
          profile,
          label: label || null,
          stateMode: nextStateMode,
          credentialBackend: resolveCredentialBackendRequest(credentialBackend),
        },
        {
          onSuccess: () => {
            setProfile("");
            setLabel("");
            setProfileSheetOpen(false);
          },
          onError: (error) => {
            setOauthError(formatDesktopError(error));
          },
        },
      );
      return;
    }

    if (mode === "api_key") {
      const apiKey = apiKeyInputRef.current?.value ?? "";
      if (apiKeyInputRef.current) {
        apiKeyInputRef.current.value = "";
      }
      void apiKeyProfileAction
        .submit({
          tool,
          profile,
          label: label || null,
          stateMode: availableStateModes.length ? stateMode : null,
          credentialBackend: resolveCredentialBackendRequest(credentialBackend),
          importMode: { kind: "api_key", value: apiKey },
        })
        .then(() => {
          setProfile("");
          setLabel("");
          setProfileSheetOpen(false);
        })
        .catch(() => undefined);
      return;
    }

    const importMode =
      mode === "from_env"
        ? { kind: "from_env" as const }
        : { kind: "from_live" as const };

    addProfileMutation.mutate(
      {
        tool,
        profile,
        label: label || null,
        stateMode: availableStateModes.length ? stateMode : null,
        credentialBackend: resolveCredentialBackendRequest(credentialBackend),
        importMode,
      },
      {
        onSuccess: () => {
          setProfile("");
          setLabel("");
          setProfileSheetOpen(false);
        },
      },
    );
  }

  function selectInventoryEntry(entryTool: (typeof TOOLS)[number], name: string) {
    setTool(entryTool);
    setExpandedDetails(name);
    if (compactLayout) {
      setCompactInspectorOpen(true);
    }
  }

  function activateInventoryEntry(entry: InventoryEntry) {
    useProfileMutation.mutate({
      tool: entry.tool,
      profile: entry.name,
      stateMode: supportedStateModes(entry.tool, toolCapabilities).length ? stateMode : null,
      label: entry.label,
    });
  }

  function openBackupsForProfile(entryTool: (typeof TOOLS)[number], name: string) {
    selectInventoryEntry(entryTool, name);
    setOpenRowActions(null);
    onOpenBackups?.();
  }

  function openProfileActions(
    entryTool: (typeof TOOLS)[number],
    name: string,
    scope: "inspector" | "table",
  ) {
    setTool(entryTool);
    setExpandedDetails(name);
    setOpenRowActions((current) =>
      current?.tool === entryTool && current?.name === name && current.scope === scope
        ? null
        : { tool: entryTool, name, scope },
    );
  }

  function openProfileSheet() {
    setOpenRowActions(null);
    setOauthEvents([]);
    setOauthError("");
    setProfile("");
    setLabel("");
    setMode("from_live");
    setCredentialBackend(initialCredentialBackend ?? "auto");
    setProfileSheetOpen(true);
  }

  function focusInventoryRow(index: number) {
    window.requestAnimationFrame(() => {
      inventoryRowRefs.current[index]?.focus();
    });
  }

  function moveInventorySelection(currentIndex: number, nextIndex: number) {
    const boundedIndex = Math.max(0, Math.min(nextIndex, filteredInventoryProfiles.length - 1));
    const target = filteredInventoryProfiles[boundedIndex];
    if (!target) {
      return;
    }
    setTool(target.tool);
    setExpandedDetails(target.name);
    focusInventoryRow(boundedIndex);
  }

  function handleInventoryKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    entry: InventoryEntry,
  ) {
    if (event.altKey) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveInventorySelection(index, index + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveInventorySelection(index, index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveInventorySelection(index, 0);
        break;
      case "End":
        event.preventDefault();
        moveInventorySelection(index, filteredInventoryProfiles.length - 1);
        break;
      case "Enter":
        if (event.metaKey) {
          event.preventDefault();
          activateInventoryEntry(entry);
        }
        break;
      default:
        break;
    }
  }

  const showInventory = !compactLayout || !compactInspectorOpen;
  const showInspector = !compactLayout || compactInspectorOpen;

  return (
    <div ref={rootRef} className="profiles-screen screen-content">
      <div className="profiles-filter-row">
        <SearchField
          className="search-field profiles-search-field"
          inputClassName="search-field-input profiles-search"
          ariaLabel="Search Profiles"
          placeholder="Search profiles…"
          value={search}
          onChange={setSearch}
        />
        <SegmentedControl
          ariaLabel="Profile filters"
          options={INVENTORY_FILTERS.map((entry) => ({
            value: entry,
            label:
              entry === "all" ? (
                "All"
              ) : (
                <ToolBrand tool={entry} className="tool-brand-inline" logoSize={15} shortName />
              ),
          }))}
          value={inventoryFilter}
          onChange={setInventoryFilter}
        />
        <button className="primary-button" type="button" onClick={openProfileSheet}>
          Add Profile
        </button>
      </div>
      <SplitView
        className="profiles-layout profiles-split-view"
        primaryClassName="profiles-inventory-pane"
        secondaryClassName="profiles-inspector-pane"
        primary={showInventory ? (
          <section className="profiles-pane profiles-table-pane" aria-label="Profile table">
            <div className="profiles-table-header" aria-hidden="true">
              <span>Name</span>
              <span>Tool</span>
              <span>Status</span>
              <span className="profiles-table-column-auth">Authentication</span>
              <span className="profiles-table-column-low">Backend</span>
              <span className="profiles-table-column-low">Last checked</span>
              <span />
            </div>
            <div className="profiles-table-body" role="listbox" aria-label="Profiles">
              {filteredInventoryProfiles.map((inventoryEntry, index) => {
                const rowSelected = expandedDetails === inventoryEntry.name && tool === inventoryEntry.tool;
                const menuKey = `${inventoryEntry.tool}:${inventoryEntry.name}`;
                const rowNeedsReapply = inventoryEntry.state === "live_mismatch";
                const rowActionAnchorRef = {
                  current: rowActionAnchorRefs.current[menuKey] ?? null,
                };
                return (
                  <div
                    key={`${inventoryEntry.tool}:${inventoryEntry.name}`}
                    className={`profiles-table-row ${rowSelected ? "profiles-table-row-selected" : ""}`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openProfileActions(inventoryEntry.tool, inventoryEntry.name, "table");
                    }}
                  >
                    <button
                      ref={(node) => {
                        inventoryRowRefs.current[index] = node;
                      }}
                      type="button"
                      className="profiles-table-row-button"
                      aria-label={`Inspect ${toolDisplayName(inventoryEntry.tool)} ${inventoryEntry.label}`}
                      role="option"
                      aria-selected={rowSelected}
                      tabIndex={rowSelected || (!expandedDetails && index === 0) ? 0 : -1}
                      onClick={() => selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name)}
                      onDoubleClick={() => selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name)}
                      onKeyDown={(event) => handleInventoryKeyDown(event, index, inventoryEntry)}
                    >
                      <div className="profiles-table-name-cell">
                        <strong>{inventoryEntry.label}</strong>
                        <span className="profiles-table-name-secondary">{inventoryEntry.name}</span>
                        <span className="profiles-table-name-compact-meta">
                          {profileCompactSummary(inventoryEntry)}
                        </span>
                      </div>
                      <span className="profiles-table-column">
                        <ToolBrand
                          tool={inventoryEntry.tool}
                          className="tool-brand-compact"
                          logoSize={16}
                          shortName
                        />
                      </span>
                      <span
                        className={`profiles-table-status profiles-table-status-${profileStatusTone(
                          inventoryEntry.state,
                        )}`}
                      >
                        {profileStatusLabel(inventoryEntry.state)}
                      </span>
                      <span className="profiles-table-column profiles-table-column-auth">
                        {authDisplayLabel(inventoryEntry.auth)}
                      </span>
                      <span className="profiles-table-column profiles-table-column-low">{inventoryEntry.backend}</span>
                      <span className="profiles-table-column profiles-table-column-low">{inventoryEntry.lastChecked}</span>
                    </button>
                    <div className="profile-row-actions" data-profile-row-actions>
                      <button
                        ref={(node) => {
                          rowActionAnchorRefs.current[menuKey] = node;
                        }}
                        className="ghost-button profile-row-actions-trigger"
                        type="button"
                        aria-label={`More actions for ${toolDisplayName(inventoryEntry.tool)} ${inventoryEntry.label}`}
                        aria-haspopup="menu"
                        aria-expanded={
                          openRowActions?.tool === inventoryEntry.tool &&
                          openRowActions?.name === inventoryEntry.name &&
                          openRowActions.scope === "table"
                        }
                        onClick={() => openProfileActions(inventoryEntry.tool, inventoryEntry.name, "table")}
                      >
                        •••
                      </button>
                      {openRowActions?.tool === inventoryEntry.tool &&
                      openRowActions?.name === inventoryEntry.name &&
                      openRowActions.scope === "table" ? (
                        <AnchoredMenu
                          anchorRef={rowActionAnchorRef}
                          className="profile-row-actions-menu"
                          align="end"
                          boundaryAttribute="data-profile-row-actions"
                          role="menu"
                          aria-label="Profile actions"
                        >
                          {!inventoryEntry.active ? (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={mutationLock.isBusy}
                              onClick={() => {
                                activateInventoryEntry(inventoryEntry);
                                setOpenRowActions(null);
                              }}
                            >
                              Activate
                            </button>
                          ) : null}
                          {rowNeedsReapply ? (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={mutationLock.isBusy}
                              onClick={() => {
                                activateInventoryEntry(inventoryEntry);
                                setOpenRowActions(null);
                              }}
                            >
                              Reapply Active Profile
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPendingEdit({ name: inventoryEntry.name, focus: "name" });
                              setOpenRowActions(null);
                            }}
                          >
                            Rename…
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPendingEdit({ name: inventoryEntry.name, focus: "label" });
                              setOpenRowActions(null);
                            }}
                          >
                            Change Label…
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={!inventoryEntry.hasBackup}
                            onClick={() => openBackupsForProfile(inventoryEntry.tool, inventoryEntry.name)}
                          >
                            View Backups
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="profile-row-actions-danger"
                            onClick={() => {
                              setPendingRemoval(inventoryEntry.name);
                              setOpenRowActions(null);
                            }}
                          >
                            Remove…
                          </button>
                        </AnchoredMenu>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!filteredInventoryProfiles.length ? (
                <div className="profiles-empty-state">
                  <h3>No matching profiles</h3>
                  <p className="inline-note">Adjust the tool filter or search query.</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        secondary={showInspector ? (
          <aside className="profiles-pane profiles-inspector">
            {selectedProfileEntry ? (
              <>
                <header className="profiles-inspector-header">
                  <div className="profiles-inspector-title-block">
                    {compactLayout ? (
                      <button
                        className="ghost-button profiles-inspector-back"
                        type="button"
                        onClick={() => setCompactInspectorOpen(false)}
                      >
                        Back
                      </button>
                    ) : null}
                    <h3 className="profiles-inspector-heading">
                      <span aria-hidden="true">
                        <ToolBrand tool={tool} className="tool-brand-inline" logoSize={18} shortName />
                      </span>
                      <span>{selectedProfileDisplay}</span>
                    </h3>
                    <p className="inline-note">{toolDisplayName(tool)}</p>
                    {selectedHasCustomLabel ? (
                      <p className="inline-note">Saved as {selectedProfileEntry.name}</p>
                    ) : null}
                    <div
                      className={`profiles-inspector-status profiles-inspector-status-${profileStatusTone(
                        selectedProfileState,
                      )}`}
                    >
                      <span aria-hidden="true">{profileStatusSymbol(selectedProfileState)}</span>
                      <span>{profileStatusLabel(selectedProfileState)}</span>
                    </div>
                  </div>
                  <div className="button-row profiles-inspector-action-row">
                    {selectedProfileCanActivate || selectedProfileNeedsReapply ? (
                      <button
                        className="primary-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          useProfileMutation.mutate({
                            tool,
                            profile: selectedProfileEntry.name,
                            stateMode: availableStateModes.length ? stateMode : null,
                            label: selectedProfileDisplay ?? selectedProfileEntry.name,
                          })
                        }
                      >
                        {selectedProfileNeedsReapply
                          ? `Reapply ${selectedProfileDisplay}`
                          : "Activate Profile"}
                      </button>
                    ) : (
                      <span className="profiles-passive-badge">Active</span>
                    )}
                    <div className="profile-row-actions" data-profile-row-actions>
                      <button
                        ref={inspectorMenuAnchorRef}
                        className="ghost-button profile-row-actions-trigger"
                        type="button"
                        aria-label="More profile actions"
                        aria-expanded={
                          openRowActions?.tool === tool &&
                          openRowActions?.name === selectedProfileEntry.name &&
                          openRowActions.scope === "inspector"
                        }
                        onClick={() =>
                          setOpenRowActions((current) =>
                            current?.tool === tool &&
                            current?.name === selectedProfileEntry.name &&
                            current.scope === "inspector"
                              ? null
                              : { tool, name: selectedProfileEntry.name, scope: "inspector" },
                          )
                        }
                      >
                        •••
                      </button>
                      {openRowActions?.tool === tool &&
                      openRowActions?.name === selectedProfileEntry.name &&
                      openRowActions.scope === "inspector" ? (
                        <AnchoredMenu
                          anchorRef={inspectorMenuAnchorRef}
                          className="profile-row-actions-menu"
                          align="start"
                          boundaryAttribute="data-profile-row-actions"
                          containmentSelector=".profiles-inspector"
                          role="menu"
                          aria-label="Profile actions"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPendingEdit({ name: selectedProfileEntry.name, focus: "name" });
                              setOpenRowActions(null);
                            }}
                          >
                            Rename…
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPendingEdit({ name: selectedProfileEntry.name, focus: "label" });
                              setOpenRowActions(null);
                            }}
                          >
                            Change Label…
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={!selectedLatestBackup}
                            onClick={() => openBackupsForProfile(tool, selectedProfileEntry.name)}
                          >
                            View Backups
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="profile-row-actions-danger"
                            onClick={() => {
                              setPendingRemoval(selectedProfileEntry.name);
                              setOpenRowActions(null);
                            }}
                          >
                            Remove…
                          </button>
                        </AnchoredMenu>
                      ) : null}
                    </div>
                  </div>
                </header>
                <KeyValueGrid
                  variant="plain"
                  rows={[
                    {
                      label: "Live match",
                      value: profileLiveMatchValue(selectedProfileState),
                    },
                    { label: "Authentication", value: authDisplayLabel(selectedProfileEntry.auth) },
                    {
                      label: "Credential storage",
                      value:
                        snapshot.profiles[tool]?.active === selectedProfileEntry.name
                          ? credentialBackendDisplay(toolStatus?.credential_backend)
                          : selectedInventoryEntry?.backend ?? BACKEND_UNAVAILABLE_LABEL,
                    },
                    {
                      label: "Added",
                      value: selectedLatestBackup
                        ? formatBackupTimestamp(selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id)
                        : "Date Unavailable",
                    },
                    {
                      label: "Last checked",
                      value: selectedInventoryEntry?.lastChecked ?? "Not Verified",
                    },
                    ...(!availableStateModes.length
                      ? [
                          {
                            label: "State mode",
                            value: selectedIsActive
                              ? stateModeDisplay(toolStatus?.state_mode)
                              : "Available after activation",
                          },
                        ]
                      : []),
                  ]}
                />
                {availableStateModes.length ? (
                  <StateModeField
                    name={`inspector-state-mode-${tool}`}
                    value={stateMode}
                    options={availableStateModes}
                    onChange={setStateMode}
                    variant="compact"
                  />
                ) : (
                  <div className="state-mode-static">
                    <span className="state-mode-static-label">State mode</span>
                    <strong>Isolated</strong>
                    <p className="state-mode-copy">
                      Gemini keeps authentication and local state together.
                    </p>
                  </div>
                )}
                <div className="profiles-inspector-disclosure">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      setOpenStorageDetails((current) =>
                        current === selectedProfileEntry.name ? null : selectedProfileEntry.name,
                      )
                    }
                  >
                    {openStorageDetails === selectedProfileEntry.name ? "Hide Storage Details" : "Storage Details"}
                  </button>
                </div>
                {openStorageDetails === selectedProfileEntry.name ? (
                  <div className="profiles-inspector-details">
                    {selectedIsActive ? (
                      <>
                        <p className="inline-note">
                          Credentials present: {booleanLabel(toolStatus?.credentials_present)}
                        </p>
                        <p className="inline-note">
                          Local permissions: {booleanLabel(toolStatus?.permissions_ok)}
                        </p>
                        {toolStatus?.token_warning ? (
                          <p className="inline-note">Token warning: {formatProfileTokenWarning(toolStatus)}</p>
                        ) : null}
                        {toolStatus?.warnings.length ? (
                          <div className="stack-list">
                            {toolStatus.warnings.map((warning, index) => (
                              <p
                                key={`${warning.code ?? warning.message ?? "warning"}-${index}`}
                                className="inline-note"
                              >
                                Warning: {formatProfileWarning(warning)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="inline-note">
                        Live storage details are available after this profile becomes active.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="profiles-empty-state profiles-empty-state-inspector">
                <h3>No profile selected</h3>
                <p className="inline-note">
                  Select a saved profile from the table to inspect activation state and storage details.
                </p>
              </div>
            )}
          </aside>
        ) : null}
      />
      {editSheetProfile && editSheetDisplay ? (
        <DialogSurface
          ariaLabel="Edit Profile"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="input:not([disabled]), button:not([disabled])"
          onClose={() => setPendingEdit(null)}
        >
          <div className="quick-switch-header">
            <div>
              <p className="card-kicker">Profile</p>
              <h3>Rename Profile</h3>
            </div>
          </div>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const nextName = editSheetRenameDraft.trim();
              const nextLabel = editSheetLabelDraft.trim();
              if (editSheetRenameDuplicate) {
                return;
              }

              if (nextName && nextName !== editSheetProfile.name) {
                renameProfileMutation.mutate({
                  tool,
                  oldName: editSheetProfile.name,
                  newName: nextName,
                });
              }

              const currentLabel =
                effectiveLabel(tool, editSheetProfile.name, editSheetProfile.label, settings) ?? "";
              if (nextLabel !== currentLabel) {
                updateSettingsMutation.mutate({
                  runtime_kind: settings.runtime_kind,
                  runtime_path: settings.runtime_path ?? null,
                  aisw_home: settings.aisw_home ?? null,
                  update_channel: settings.update_channel,
                  profile_sets: settings.profile_sets,
                  profile_labels: mergeProfileLabel(
                    settings,
                    tool,
                    editSheetProfile.name,
                    nextLabel || null,
                  ),
                });
              }

              setPendingEdit(null);
            }}
          >
            <label>
              Current name
              <input value={editSheetProfile.name} disabled />
            </label>
            <label>
              New name
              <input
                ref={renameInputRef}
                aria-label={`rename ${editSheetProfile.name}`}
                value={editSheetRenameDraft}
                onChange={(event) =>
                  setRenameDrafts((current) => ({
                    ...current,
                    [editSheetProfile.name]: event.target.value,
                  }))
                }
              />
            </label>
            {editSheetRenameDuplicate ? (
              <p className="inline-note">{duplicateWarning(tool, editSheetRenameDraft.trim())}</p>
            ) : null}
            <label>
              Display label
              <input
                ref={editLabelInputRef}
                aria-label={`label ${editSheetProfile.name}`}
                value={editSheetLabelDraft}
                onChange={(event) =>
                  setLabelDrafts((current) => ({
                    ...current,
                    [editSheetProfile.name]: event.target.value,
                  }))
                }
              />
            </label>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setPendingEdit(null)}>
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={mutationLock.isBusy || Boolean(editSheetRenameDuplicate)}
              >
                Save
              </button>
            </div>
          </form>
        </DialogSurface>
      ) : null}
      {removalSheetProfile && removalSheetDisplay ? (
        <DialogSurface
          ariaLabel="Remove Profile"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingRemoval(null)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Removal</p>
                <h3>Remove “{removalSheetDisplay}”?</h3>
              </div>
            </div>
            <p className="inline-note">
              AI Switch creates a backup before removal. Current live credentials are not removed automatically.
            </p>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => setPendingRemoval(null)}>
                  Cancel
                </button>
                <button
                  className="ghost-button danger-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() => {
                    setPendingRemoval(null);
                    removeProfileMutation.mutate({
                      tool,
                      profile: removalSheetProfile.name,
                      force: snapshot.profiles[tool]?.active === removalSheetProfile.name,
                    });
                  }}
                >
                  Remove Profile
                </button>
              </div>
            </footer>
        </DialogSurface>
      ) : null}
      {profileSheetOpen ? (
        <DialogSurface
          ariaLabel="Add Profile"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="select:not([disabled]), input:not([disabled]), button:not([disabled])"
          onClose={() => setProfileSheetOpen(false)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Add Profile</p>
                <h3>Add a saved login</h3>
              </div>
            </div>
            <form className="stacked-form" onSubmit={submit}>
              <label>
                Tool
                <select
                  value={tool}
                  onChange={(event) => {
                    setTool(event.target.value as typeof tool);
                    setExpandedDetails(null);
                  }}
                >
                  {TOOLS.map((entry) => (
                    <option key={entry} value={entry}>
                      {toolDisplayName(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profile name
                <input value={profile} onChange={(event) => setProfile(event.target.value)} />
              </label>
              {hasDuplicateProfileName ? (
                <p className="inline-note">{duplicateWarning(tool, duplicateDraftName)}</p>
              ) : null}
              <label>
                Display label
                <input value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <label>
                Authentication
                <select
                  aria-label="Import mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as typeof mode)}
                >
                  {availableImportModes.map((entry) => (
                    <option key={entry} value={entry}>
                      {profileImportModeLabel(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profiles-sheet-note">
                <p className="card-kicker">Mode</p>
                <h4>{profileImportModeHeading(tool, mode)}</h4>
                {profileImportModeNotes(tool, mode).map((note) => (
                  <p key={note} className="inline-note">
                    {note}
                  </p>
                ))}
              </div>
              <label>
                Credential backend
                <select
                  value={credentialBackend}
                  onChange={(event) =>
                    setCredentialBackend(event.target.value as typeof credentialBackend)
                  }
                  disabled={availableCredentialBackends.length === 1}
                >
                  {availableCredentialBackends.map((entry) => (
                    <option key={entry} value={entry}>
                      {profileCredentialBackendLabel(entry)}
                    </option>
                  ))}
                </select>
              </label>
              {availableCredentialBackends.length === 1 && availableCredentialBackends[0] === "file" ? (
                <p className="inline-note">
                  {toolShortName(tool)} profiles are always stored with file-backed credentials.
                </p>
              ) : null}
              {mode === "api_key" ? (
                <label>
                  API key
                  <input
                    ref={apiKeyInputRef}
                    type="password"
                    autoComplete="off"
                    onChange={() => {
                      if (apiKeyProfileAction.error) {
                        apiKeyProfileAction.clearError();
                      }
                    }}
                  />
                </label>
              ) : null}
              {mode === "from_env" ? (
                <p className="inline-note">
                  Expected environment variable: <code>{toolApiKeyEnvVar(tool)}</code>
                </p>
              ) : null}
              {mode === "oauth" ? (
                <div className="diagnostic-card">
                  <h4>Sign-in flow</h4>
                  <p className="inline-note">
                    AI Switch will launch the tool&apos;s native login flow and stream progress from the included desktop engine.
                  </p>
                  <p className="inline-note">
                    Keep this window open while the browser or terminal login completes.
                  </p>
                </div>
              ) : null}
              {availableStateModes.length ? (
                <StateModeField
                  name={`profile-state-mode-${tool}`}
                  value={stateMode}
                  options={availableStateModes}
                  onChange={setStateMode}
                  variant="compact"
                />
              ) : (
                <div className="state-mode-static">
                  <span className="state-mode-static-label">State mode</span>
                  <strong>Isolated</strong>
                  <p className="state-mode-copy">
                    Gemini keeps authentication and local state together.
                  </p>
                </div>
              )}
              {mode === "oauth" ? (
                <article className="diagnostic-card">
                  <h4>OAuth progress</h4>
                  {oauthWizardSteps.some((step) => step.status !== "pending") ? (
                    <div className="stack-list">
                      {oauthWizardSteps.map((step) => (
                        <div key={step.id}>
                          <p className={`diagnostic-status diagnostic-status-${step.status}`}>
                            {step.label}
                          </p>
                          <p className="inline-note">{step.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="inline-note">
                      Start OAuth to stream each login step before the profile is captured and saved.
                    </p>
                  )}
                  {oauthError ? <p className="inline-note">{oauthError}</p> : null}
                </article>
              ) : null}
              <div className="button-row">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setProfileSheetOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    mutationLock.isBusy ||
                    addProfileMutation.isPending ||
                    addProfileOAuthMutation.isPending ||
                    apiKeyProfileAction.isPending ||
                    hasDuplicateProfileName
                  }
                >
                  {mode === "oauth"
                    ? addProfileOAuthMutation.isPending
                      ? "Waiting for sign-in…"
                      : "Start Sign In"
                    : mode === "api_key"
                      ? apiKeyProfileAction.isPending
                        ? "Saving…"
                        : "Save Profile"
                      : mode === "from_env"
                        ? addProfileMutation.isPending
                          ? "Saving…"
                          : "Save Profile"
                        : addProfileMutation.isPending
                          ? "Importing…"
                          : "Import"}
                </button>
              </div>
              {profileMutationError(
                addProfileMutation.error,
                addProfileOAuthMutation.error,
                renameProfileMutation.error,
                removeProfileMutation.error,
                useProfileMutation.error,
                apiKeyProfileAction.error,
              ) ? (
                <p className="inline-note">
                  {profileMutationError(
                    addProfileMutation.error,
                    addProfileOAuthMutation.error,
                    renameProfileMutation.error,
                    removeProfileMutation.error,
                    useProfileMutation.error,
                    apiKeyProfileAction.error,
                  )}
                </p>
              ) : null}
            </form>
        </DialogSurface>
      ) : null}
    </div>
  );
}

function isSupportedTool(tool: string | undefined): tool is (typeof TOOLS)[number] {
  return Boolean(tool && TOOLS.includes(tool as (typeof TOOLS)[number]));
}

function profileImportModeLabel(mode: ProfileImportMode) {
  switch (mode) {
    case "from_live":
      return "Import current login";
    case "from_env":
      return "Read from environment";
    case "api_key":
      return "Paste API key";
    case "oauth":
      return "Sign in with OAuth";
  }
}

function profileImportModeHeading(tool: string, mode: ProfileImportMode) {
  const toolName = toolDisplayName(tool);
  switch (mode) {
    case "from_live":
      return `Import current ${toolName} login`;
    case "from_env":
      return "Read from environment";
    case "api_key":
      return "Paste API key";
    case "oauth":
      return `Sign in to ${toolName}`;
  }
}

function profileImportModeNotes(tool: string, mode: ProfileImportMode) {
  const toolName = toolDisplayName(tool);
  switch (mode) {
    case "from_live":
      return [
        `Capture the ${toolName} credentials already active on this Mac.`,
      ];
    case "from_env":
      return [
        `Read ${toolApiKeyEnvVar(tool)} from the current environment when you save this profile.`,
      ];
    case "api_key":
      return [
        "Paste the provider key once. AI Switch sends it to the desktop engine without storing it in the form state.",
      ];
    case "oauth":
      return [
        `Open the normal ${toolName} sign-in flow and keep this sheet open until it finishes.`,
      ];
  }
}

function profileCredentialBackendLabel(backend: ProfileCredentialBackend) {
  switch (backend) {
    case "auto":
      return "Automatic";
    case "system-keyring":
      return "System keyring";
    case "file":
      return "File-backed";
  }
}

function formatBackendLabel(backend: string) {
  switch (backend) {
    case "system_keyring":
      return "Keychain";
    case "file":
      return "File";
    default:
      return titleCase(backend.split("_").join(" "));
  }
}

function profileCompactSummary(entry: InventoryEntry) {
  return `${toolDisplayName(entry.tool)} · ${profileStatusLabel(entry.state)}`;
}

function effectiveLabel(
  tool: string,
  profile: string,
  currentLabel: string | null | undefined,
  settings: DesktopSettings,
) {
  const override = settings.profile_labels?.[tool]?.[profile];
  return override ?? currentLabel ?? null;
}

function mergeProfileLabel(
  settings: DesktopSettings,
  tool: string,
  profile: string,
  label: string | null,
) {
  const next = {
    ...(settings.profile_labels ?? {}),
    [tool]: {
      ...(settings.profile_labels?.[tool] ?? {}),
      [profile]: label,
    },
  };

  if (label === null && Object.values(next[tool]).every((value) => value == null)) {
    delete next[tool];
  }

  return next;
}

function latestBackupForProfile(
  tool: string,
  profile: string,
  backups: Array<{ backup_id: string; tool: string; profile: string; created_at?: string | null }> | undefined,
) {
  return [...(backups ?? [])]
    .filter(
      (entry) =>
        entry.tool === tool &&
        (entry.profile === profile || entry.profile === `${tool}/${profile}`),
    )
    .sort(compareBackupsNewestFirst)[0];
}

type OAuthWizardStep = {
  id: "start" | "browser" | "login" | "capture" | "saved";
  label: string;
  detail: string;
  status: "pending" | "warn" | "pass" | "fail";
};

function buildOauthWizardSteps(
  tool: string,
  events: OAuthProgressEvent[],
  oauthError: string,
): OAuthWizardStep[] {
  const definitions = [
    {
      id: "start" as const,
      label: `1. Starting ${titleCase(tool)} login`,
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
  const seen = new Map<
    OAuthWizardStep["id"],
    { detail: string; failed: boolean }
  >();
  let highestReached = -1;
  let terminalFailure = false;

  for (const event of events) {
    const stage = oauthEventStage(event);
    if (!stage) continue;
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

function oauthEventStage(event: OAuthProgressEvent): OAuthWizardStep["id"] | null {
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

function profileMutationError(...errors: Array<unknown>) {
  for (const error of errors) {
    if (!error) continue;
    return formatDesktopError(error);
  }
  return "";
}

function formatDesktopError(error: unknown) {
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

function formatProfileTokenWarning(
  status: NonNullable<AppSnapshot["statuses"][number]>,
) {
  const warning = status.token_warning;
  if (!warning) {
    return "Token state needs attention.";
  }
  const detail = warning.summary ?? warning.message ?? warning.code ?? "Token state needs attention.";
  const suffix = warning.expires_at
    ? ` Expires at ${warning.expires_at}.`
    : typeof warning.expires_in_days === "number"
      ? ` Expires in ${warning.expires_in_days} days.`
      : "";
  return `${detail}${suffix}`;
}

function formatProfileWarning(
  warning: NonNullable<AppSnapshot["statuses"][number]["warnings"]>[number],
) {
  const detail = warning.message ?? warning.code ?? "Warning reported by AI Switch.";
  return warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;
}

function credentialBackendDisplay(backend: string | null | undefined) {
  if (!backend) {
    return BACKEND_UNAVAILABLE_LABEL;
  }
  return formatBackendLabel(backend);
}

function stateModeDisplay(mode: string | null | undefined) {
  if (!mode) {
    return NOT_AVAILABLE_LABEL;
  }
  return titleCase(mode);
}

function profileStatusTone(state: ProfileSwitchState) {
  return profileSwitchTone(state);
}

function profileStatusLabel(state: ProfileSwitchState) {
  return profileSwitchLabel(state);
}

function profileStatusSymbol(state: ProfileSwitchState) {
  return profileSwitchSymbol(state);
}

function profileLiveMatchValue(state: ProfileSwitchState) {
  return profileLiveMatchLabel(state);
}

function booleanLabel(value: boolean | null | undefined) {
  if (value === undefined || value === null) {
    return VERIFICATION_REQUIRED_LABEL;
  }
  return value ? "Yes" : "No";
}

function formatBackupTimestamp(value: string) {
  return formatDateTimeWithZone(value);
}

function authDisplayLabel(auth: string) {
  if (auth === "oauth") {
    return "OAuth";
  }
  if (auth === "api_key") {
    return "API Key";
  }
  return titleCase(auth.split("_").join(" "));
}

function duplicateWarning(tool: string, profile: string) {
  return `${titleCase(tool)} already has a profile named ${profile}. Choose a different name or rename the existing profile first.`;
}

function isDuplicateProfileName(
  profiles: AppSnapshot["profiles"][string]["profiles"],
  currentName: string,
  nextName: string,
) {
  const normalizedCurrent = currentName.trim().toLowerCase();
  const normalizedNext = nextName.trim().toLowerCase();
  return profiles.some(
    (entry) => entry.name.trim().toLowerCase() === normalizedNext && entry.name.trim().toLowerCase() !== normalizedCurrent,
  );
}
