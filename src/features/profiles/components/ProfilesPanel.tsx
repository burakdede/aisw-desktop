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
import { credentialBackendLabel as formatCredentialBackendLabel } from "../../../lib/credential-backends";
import { formatDateTimeWithZone } from "../../../lib/date-format";
import { BACKEND_UNAVAILABLE_LABEL } from "../../../lib/display-copy";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import {
  AVAILABLE_AFTER_ACTIVATION_LABEL,
  profileAddedLabel,
  profileAuthMethodLabel,
  profileLastCheckedLabel,
  profileStateModeLabel,
  profileStorageBooleanLabel,
  profileStorageDetailsToggleLabel,
  profileTokenWarningLabel,
  profileWarningLabel,
} from "../../../lib/profile-detail-display";
import {
  effectiveToolProfileLabel,
  mergeProfileLabel,
} from "../../../lib/profile-display";
import {
  profileLiveMatchLabel,
  profileSwitchLabel,
  profileSwitchSymbol,
  profileSwitchTone,
  resolveProfileSwitchState,
  type ProfileSwitchState,
} from "../../../lib/status-display";
import { listenDesktopEvent } from "../../../lib/tauri";
import { listBackups, parseOAuthProgressEvent } from "../../../lib/client";
import {
  SUPPORTED_TOOLS,
  isSupportedTool,
  toolApiKeyEnvVar,
  toolShortName,
  type SupportedTool,
} from "../../../lib/tool-registry";
import { toolDisplayName } from "../../../lib/tool-display";
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
import {
  duplicateProfileNameWarning,
  profileCompactSummary,
  profileCredentialBackendLabel,
  profileImportModeHeading,
  profileImportModeLabel,
  profileImportModeNotes,
} from "../profile-sheet-display";
import {
  buildInventoryProfiles,
  buildProfileActionMenu,
  buildSelectedProfileInspectorState,
  buildOauthWizardSteps,
  filterInventoryProfiles,
  formatDesktopError,
  findSelectedInventoryEntry,
  INVENTORY_FILTERS,
  isDuplicateProfileName,
  latestBackupForProfile,
  profileMutationError,
  type InventoryEntry,
  type InventoryFilter,
} from "../profiles-panel-display";

const TOOLS = SUPPORTED_TOOLS;

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
  const resolvedInitialTool =
    initialTool && isSupportedTool(initialTool) ? initialTool : null;
  const [tool, setTool] = useState<SupportedTool>(
    resolvedInitialTool ?? "claude",
  );
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>(
    resolvedInitialTool ?? "all",
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
  const inventoryProfiles = useMemo(
    () =>
      buildInventoryProfiles({
        backups: backups.data,
        inventoryFilter,
        settings,
        snapshot,
      }),
    [backups.data, inventoryFilter, settings, snapshot],
  );
  const filteredInventoryProfiles = useMemo(
    () => filterInventoryProfiles(inventoryProfiles, search),
    [inventoryProfiles, search],
  );
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
  const selectedInventoryEntry = useMemo(
    () => findSelectedInventoryEntry(inventoryProfiles, tool, expandedDetails),
    [expandedDetails, inventoryProfiles, tool],
  );
  const selectedProfileEntry = useMemo(
    () => profiles.find((entry) => entry.name === expandedDetails) ?? null,
    [expandedDetails, profiles],
  );
  const selectedProfileDisplay = useMemo(
    () =>
      selectedProfileEntry
        ? effectiveToolProfileLabel(
            settings,
            tool,
            selectedProfileEntry.name,
            selectedProfileEntry.label,
          )
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
  const selectedProfileInspectorState = buildSelectedProfileInspectorState({
    activeProfileApplied: toolStatus?.active_profile_applied,
    activeProfileName: snapshot.profiles[tool]?.active,
    selectedProfileDisplay,
    selectedProfileName: selectedProfileEntry?.name ?? null,
  });
  const editSheetProfile = pendingEdit
    ? profiles.find((entry) => entry.name === pendingEdit.name) ?? null
    : null;
  const editSheetDisplay = editSheetProfile
    ? effectiveToolProfileLabel(settings, tool, editSheetProfile.name, editSheetProfile.label)
    : null;
  const editSheetRenameDraft = editSheetProfile ? renameDrafts[editSheetProfile.name] ?? editSheetProfile.name : "";
  const editSheetLabelDraft = editSheetProfile
    ? labelDrafts[editSheetProfile.name] ??
      effectiveToolProfileLabel(settings, tool, editSheetProfile.name, editSheetProfile.label) ??
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
    ? effectiveToolProfileLabel(settings, tool, removalSheetProfile.name, removalSheetProfile.label)
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
    if (!resolvedInitialTool) {
      return;
    }
    setTool(resolvedInitialTool);
    setInventoryFilter(resolvedInitialTool);
  }, [resolvedInitialTool]);

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
      (Boolean(resolvedInitialTool) ||
        Boolean(initialMode) ||
        Boolean(initialCredentialBackend) ||
        openToken != null)
    ) {
      setProfileSheetOpen(true);
    }
  }, [initialCredentialBackend, initialExpandedProfile, initialMode, openToken, resolvedInitialTool]);

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
                const rowActions = buildProfileActionMenu({
                  active: inventoryEntry.active,
                  hasBackup: inventoryEntry.hasBackup,
                  scope: "table",
                  state: inventoryEntry.state,
                });
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
                        className={`profiles-table-status profiles-table-status-${profileSwitchTone(
                          inventoryEntry.state,
                        )}`}
                      >
                        {profileSwitchLabel(inventoryEntry.state)}
                      </span>
                      <span className="profiles-table-column profiles-table-column-auth">
                        {profileAuthMethodLabel(inventoryEntry.auth)}
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
                          openRowActions?.scope === "table"
                        }
                        onClick={() => openProfileActions(inventoryEntry.tool, inventoryEntry.name, "table")}
                      >
                        •••
                      </button>
                      {openRowActions?.tool === inventoryEntry.tool &&
                      openRowActions?.name === inventoryEntry.name &&
                      openRowActions?.scope === "table" ? (
                        <AnchoredMenu
                          anchorRef={rowActionAnchorRef}
                          className="profile-row-actions-menu"
                          align="end"
                          boundaryAttribute="data-profile-row-actions"
                          role="menu"
                          aria-label="Profile actions"
                        >
                          {rowActions.map((action) => (
                            <button
                              key={action.kind}
                              type="button"
                              role="menuitem"
                              disabled={
                                action.kind === "view_backups"
                                  ? action.disabled
                                  : mutationLock.isBusy
                              }
                              className={action.danger ? "profile-row-actions-danger" : undefined}
                              onClick={() => {
                                switch (action.kind) {
                                  case "activate":
                                  case "reapply":
                                    activateInventoryEntry(inventoryEntry);
                                    break;
                                  case "rename":
                                    setPendingEdit({ name: inventoryEntry.name, focus: "name" });
                                    break;
                                  case "change_label":
                                    setPendingEdit({ name: inventoryEntry.name, focus: "label" });
                                    break;
                                  case "view_backups":
                                    openBackupsForProfile(inventoryEntry.tool, inventoryEntry.name);
                                    break;
                                  case "remove":
                                    setPendingRemoval(inventoryEntry.name);
                                    break;
                                }
                                setOpenRowActions(null);
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
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
                    {selectedProfileInspectorState.hasCustomLabel ? (
                      <p className="inline-note">Saved as {selectedProfileEntry.name}</p>
                    ) : null}
                    <div
                      className={`profiles-inspector-status profiles-inspector-status-${profileSwitchTone(
                        selectedProfileInspectorState.state,
                      )}`}
                    >
                      <span aria-hidden="true">{profileSwitchSymbol(selectedProfileInspectorState.state)}</span>
                      <span>{profileSwitchLabel(selectedProfileInspectorState.state)}</span>
                    </div>
                  </div>
                  <div className="button-row profiles-inspector-action-row">
                    {selectedProfileInspectorState.primaryActionLabel ? (
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
                        {selectedProfileInspectorState.primaryActionLabel}
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
                          openRowActions?.scope === "inspector"
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
                      openRowActions?.scope === "inspector" ? (
                        <AnchoredMenu
                          anchorRef={inspectorMenuAnchorRef}
                          className="profile-row-actions-menu"
                          align="start"
                          boundaryAttribute="data-profile-row-actions"
                          containmentSelector=".profiles-inspector"
                          role="menu"
                          aria-label="Profile actions"
                        >
                          {buildProfileActionMenu({
                            active: selectedProfileInspectorState.isActive,
                            hasBackup: Boolean(selectedLatestBackup),
                            scope: "inspector",
                            state: selectedProfileInspectorState.state,
                          }).map((action) => (
                            <button
                              key={action.kind}
                              type="button"
                              role="menuitem"
                              disabled={action.kind === "view_backups" ? action.disabled : false}
                              className={action.danger ? "profile-row-actions-danger" : undefined}
                              onClick={() => {
                                switch (action.kind) {
                                  case "rename":
                                    setPendingEdit({ name: selectedProfileEntry.name, focus: "name" });
                                    break;
                                  case "change_label":
                                    setPendingEdit({ name: selectedProfileEntry.name, focus: "label" });
                                    break;
                                  case "view_backups":
                                    openBackupsForProfile(tool, selectedProfileEntry.name);
                                    break;
                                  case "remove":
                                    setPendingRemoval(selectedProfileEntry.name);
                                    break;
                                  default:
                                    break;
                                }
                                setOpenRowActions(null);
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
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
                      value: profileLiveMatchLabel(selectedProfileInspectorState.state),
                    },
                    { label: "Authentication", value: profileAuthMethodLabel(selectedProfileEntry.auth) },
                    {
                      label: "Credential storage",
                      value:
                        snapshot.profiles[tool]?.active === selectedProfileEntry.name
                          ? formatCredentialBackendLabel(toolStatus?.credential_backend, "inventory")
                          : selectedInventoryEntry?.backend ?? BACKEND_UNAVAILABLE_LABEL,
                    },
                    {
                      label: "Added",
                      value: profileAddedLabel(
                        selectedLatestBackup
                          ? formatDateTimeWithZone(
                              selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id,
                            )
                          : null,
                      ),
                    },
                    {
                      label: "Last checked",
                      value: selectedInventoryEntry?.lastChecked ?? profileLastCheckedLabel(null, selectedProfileInspectorState.isActive),
                    },
                    ...(!availableStateModes.length
                      ? [
                          {
                            label: "State mode",
                            value: selectedProfileInspectorState.isActive
                              ? profileStateModeLabel(toolStatus?.state_mode)
                              : AVAILABLE_AFTER_ACTIVATION_LABEL,
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
                    {profileStorageDetailsToggleLabel(openStorageDetails === selectedProfileEntry.name)}
                  </button>
                </div>
                {openStorageDetails === selectedProfileEntry.name ? (
                  <div className="profiles-inspector-details">
                    {selectedProfileInspectorState.isActive ? (
                      <>
                        <p className="inline-note">
                          Credentials present: {profileStorageBooleanLabel(toolStatus?.credentials_present)}
                        </p>
                        <p className="inline-note">
                          Local permissions: {profileStorageBooleanLabel(toolStatus?.permissions_ok)}
                        </p>
                        {toolStatus?.token_warning ? (
                          <p className="inline-note">Token warning: {profileTokenWarningLabel(toolStatus)}</p>
                        ) : null}
                        {toolStatus?.warnings.length ? (
                          <div className="stack-list">
                            {toolStatus.warnings.map((warning, index) => (
                              <p
                                key={`${warning.code ?? warning.message ?? "warning"}-${index}`}
                                className="inline-note"
                              >
                                Warning: {profileWarningLabel(warning)}
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

              const currentLabel = effectiveToolProfileLabel(
                settings,
                tool,
                editSheetProfile.name,
                editSheetProfile.label,
              );
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
              <p className="inline-note">
                {duplicateProfileNameWarning(tool, editSheetRenameDraft.trim())}
              </p>
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
                <p className="inline-note">
                  {duplicateProfileNameWarning(tool, duplicateDraftName)}
                </p>
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
