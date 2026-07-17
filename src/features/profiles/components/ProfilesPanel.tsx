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
import { DESKTOP_QUERY_KEYS } from "../../../lib/desktop-query-keys";
import { disposeSafely, type AsyncDispose } from "../../../lib/async-dispose";
import { BACKEND_UNAVAILABLE_LABEL } from "../../../lib/display-copy";
import { eventTargetWithinSelector } from "../../../lib/dom-events";
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
  type SupportedTool,
} from "../../../lib/tool-registry";
import { toolDisplayName } from "../../../lib/tool-display";
import {
  DEFAULT_PROFILE_CREDENTIAL_BACKEND,
  DEFAULT_PROFILE_IMPORT_MODE,
  resolveCredentialBackendRequest,
  supportedCredentialBackends,
  supportedProfileImportModes,
  type ExplicitProfileCredentialBackend,
  type ProfileCredentialBackend,
  type ProfileImportMode,
} from "../../shared/profile-capabilities";
import { DEFAULT_EDITABLE_STATE_MODE, supportedStateModes } from "../../shared/state-modes";
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
  buildProfileInspectAriaLabel,
  buildProfileActivationRequest,
  buildInventoryProfiles,
  buildProfileActionMenu,
  buildProfileEditSheetState,
  buildProfileFileBackendNote,
  buildProfileRemovalHeading,
  buildProfileLabelUpdateRequest,
  buildProfileRemovalSheetState,
  buildProfileRowActionsAriaLabel,
  buildProfileSavedAsLabel,
  buildProfileSheetDraftReset,
  buildProfileSheetSubmitLabel,
  buildSelectedProfileInspectorState,
  buildOauthWizardSteps,
  defaultExpandedProfileName,
  filterInventoryProfiles,
  formatDesktopError,
  findSelectedInventoryEntry,
  INVENTORY_FILTERS,
  inventoryKeyActionForEvent,
  isDuplicateProfileName,
  latestBackupForProfile,
  nextInventorySelectionIndex,
  normalizeInventoryFilter,
  normalizeProfileSheetCredentialBackend,
  normalizeProfileSheetImportMode,
  normalizeProfileSheetTool,
  profileMutationError,
  PROFILE_ADD_SHEET_COPY,
  PROFILE_EDIT_SHEET_COPY,
  PROFILE_INSPECTOR_FIELD_LABELS,
  PROFILE_PANEL_COPY,
  PROFILE_REMOVAL_SHEET_COPY,
  resolveAvailableSelection,
  STATIC_STATE_MODE_COPY,
  STATIC_STATE_MODE_LABEL,
  shouldAutoOpenProfileSheet,
  toggleProfileActionMenu,
  type InventoryEntry,
  type InventoryFilter,
  type ProfileActionMenuItem,
  type ProfileActionTarget,
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
  initialCredentialBackend?: ExplicitProfileCredentialBackend | null;
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
    initialMode ?? DEFAULT_PROFILE_IMPORT_MODE,
  );
  const [credentialBackend, setCredentialBackend] = useState<ProfileCredentialBackend>(
    initialCredentialBackend ?? DEFAULT_PROFILE_CREDENTIAL_BACKEND,
  );
  const [stateMode, setStateMode] = useState<string>(DEFAULT_EDITABLE_STATE_MODE);
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
  const backups = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.backups,
    queryFn: listBackups,
    enabled: readEnabled,
  });
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
  const editSheetState = buildProfileEditSheetState({
    pendingEdit,
    profiles,
    settings,
    tool,
    renameDrafts,
    labelDrafts,
  });
  const removalSheetState = buildProfileRemovalSheetState({
    pendingRemoval,
    profiles,
    settings,
    tool,
  });
  const mutationErrorMessage = profileMutationError(
    addProfileMutation.error,
    addProfileOAuthMutation.error,
    renameProfileMutation.error,
    removeProfileMutation.error,
    useProfileMutation.error,
    apiKeyProfileAction.error,
  );

  useEffect(() => {
    const nextStateMode = resolveAvailableSelection(
      stateMode,
      availableStateModes,
      DEFAULT_EDITABLE_STATE_MODE,
    );
    if (nextStateMode !== stateMode) {
      setStateMode(nextStateMode);
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
    const nextMode = resolveAvailableSelection(
      mode,
      availableImportModes,
      DEFAULT_PROFILE_IMPORT_MODE,
    );
    if (nextMode !== mode) {
      setMode(nextMode);
    }
  }, [availableImportModes, mode]);

  useEffect(() => {
    const next = initialCredentialBackend ?? DEFAULT_PROFILE_CREDENTIAL_BACKEND;
    setCredentialBackend(next);
  }, [initialCredentialBackend]);

  useEffect(() => {
    const nextCredentialBackend = resolveAvailableSelection(
      credentialBackend,
      availableCredentialBackends,
      DEFAULT_PROFILE_CREDENTIAL_BACKEND,
    );
    if (nextCredentialBackend !== credentialBackend) {
      setCredentialBackend(nextCredentialBackend);
    }
  }, [availableCredentialBackends, credentialBackend]);

  useEffect(() => {
    setExpandedDetails(initialExpandedProfile ?? null);
    setOpenStorageDetails(null);
  }, [initialExpandedProfile, initialTool]);

  useEffect(() => {
    if (
      shouldAutoOpenProfileSheet({
        initialExpandedProfile,
        resolvedInitialTool,
        initialMode,
        initialCredentialBackend,
        openToken,
      })
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
    const nextDefault = defaultExpandedProfileName({
      expandedDetails,
      activeProfile: snapshot.profiles[tool]?.active,
      profiles,
    });
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
    let unlisten: AsyncDispose | undefined;
    void listenDesktopEvent<unknown>("oauth-progress", (payload) => {
      if (!active) return;
      const event = parseOAuthProgressEvent(payload);
      setOauthEvents((current) => [...current, event]);
    }).then((dispose) => {
      unlisten = typeof dispose === "function" ? dispose : undefined;
    }).catch(() => {
      unlisten = undefined;
    });

    return () => {
      active = false;
      disposeSafely(unlisten);
    };
  }, []);

  useEffect(() => {
    if (!openRowActions) {
      return;
    }

    function closeActions(event: MouseEvent) {
      if (eventTargetWithinSelector(event.target, "[data-profile-row-actions]")) {
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
        : { kind: DEFAULT_PROFILE_IMPORT_MODE };

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
    useProfileMutation.mutate(
      buildProfileActivationRequest({
        tool: entry.tool,
        profileName: entry.name,
        profileLabel: entry.label,
        selectedStateMode: stateMode,
        availableStateModes: supportedStateModes(entry.tool, toolCapabilities),
      }),
    );
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
      toggleProfileActionMenu(current, { tool: entryTool, name, scope }),
    );
  }

  function openProfileSheet() {
    setOpenRowActions(null);
    setOauthEvents([]);
    setOauthError("");
    const resetDrafts = buildProfileSheetDraftReset(initialCredentialBackend);
    setProfile(resetDrafts.profile);
    setLabel(resetDrafts.label);
    setMode(resetDrafts.mode);
    setCredentialBackend(resetDrafts.credentialBackend);
    setProfileSheetOpen(true);
  }

  function handleProfileAction(
    action: ProfileActionMenuItem,
    target: ProfileActionTarget,
  ) {
    switch (action.kind) {
      case "activate":
      case "reapply": {
        const entry = inventoryProfiles.find(
          (candidate) =>
            candidate.tool === target.tool && candidate.name === target.name,
        );
        if (entry) {
          activateInventoryEntry(entry);
        }
        break;
      }
      case "rename":
        setPendingEdit({ name: target.name, focus: "name" });
        break;
      case "change_label":
        setPendingEdit({ name: target.name, focus: "label" });
        break;
      case "view_backups":
        openBackupsForProfile(target.tool, target.name);
        return;
      case "remove":
        setPendingRemoval(target.name);
        break;
    }
    setOpenRowActions(null);
  }

  function focusInventoryRow(index: number) {
    window.requestAnimationFrame(() => {
      inventoryRowRefs.current[index]?.focus();
    });
  }

  function moveInventorySelection(currentIndex: number, nextIndex: number) {
    const boundedIndex = Math.max(
      0,
      Math.min(nextIndex, filteredInventoryProfiles.length - 1),
    );
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
    const action = inventoryKeyActionForEvent(event.key, event.metaKey, event.altKey);
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.kind === "activate") {
      activateInventoryEntry(entry);
      return;
    }
    const nextIndex = nextInventorySelectionIndex(
      index,
      filteredInventoryProfiles.length,
      action.direction,
    );
    if (nextIndex != null) {
      moveInventorySelection(index, nextIndex);
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
          ariaLabel={PROFILE_PANEL_COPY.searchAriaLabel}
          placeholder={PROFILE_PANEL_COPY.searchPlaceholder}
          value={search}
          onChange={setSearch}
        />
        <SegmentedControl
          ariaLabel={PROFILE_PANEL_COPY.filterAriaLabel}
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
          onChange={(value) => setInventoryFilter(normalizeInventoryFilter(value, inventoryFilter))}
        />
        <button className="primary-button" type="button" onClick={openProfileSheet}>
          {PROFILE_PANEL_COPY.addProfileLabel}
        </button>
      </div>
      <SplitView
        className="profiles-layout profiles-split-view"
        primaryClassName="profiles-inventory-pane"
        secondaryClassName="profiles-inspector-pane"
        primary={showInventory ? (
          <section className="profiles-pane profiles-table-pane" aria-label={PROFILE_PANEL_COPY.tableAriaLabel}>
            <div className="profiles-table-header" aria-hidden="true">
              {PROFILE_PANEL_COPY.tableColumns.map((column) => (
                <span key={column.label} className={column.className}>
                  {column.label}
                </span>
              ))}
              <span />
            </div>
            <div className="profiles-table-body" role="listbox" aria-label={PROFILE_PANEL_COPY.listAriaLabel}>
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
                      aria-label={buildProfileInspectAriaLabel(inventoryEntry.tool, inventoryEntry.label)}
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
                        aria-label={buildProfileRowActionsAriaLabel(
                          inventoryEntry.tool,
                          inventoryEntry.label,
                        )}
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
                          aria-label={PROFILE_PANEL_COPY.actionMenuAriaLabel}
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
                              onClick={() =>
                                handleProfileAction(action, {
                                  tool: inventoryEntry.tool,
                                  name: inventoryEntry.name,
                                })
                              }
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
                  <h3>{PROFILE_PANEL_COPY.emptyInventoryHeading}</h3>
                  <p className="inline-note">{PROFILE_PANEL_COPY.emptyInventoryDetail}</p>
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
                      <p className="inline-note">{buildProfileSavedAsLabel(selectedProfileEntry.name)}</p>
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
                          useProfileMutation.mutate(
                            buildProfileActivationRequest({
                              tool,
                              profileName: selectedProfileEntry.name,
                              profileLabel:
                                selectedProfileDisplay ?? selectedProfileEntry.name,
                              selectedStateMode: stateMode,
                              availableStateModes,
                            }),
                          )
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
                        aria-label={PROFILE_PANEL_COPY.inspectorTriggerAriaLabel}
                        aria-expanded={
                          openRowActions?.tool === tool &&
                          openRowActions?.name === selectedProfileEntry.name &&
                          openRowActions?.scope === "inspector"
                        }
                        onClick={() =>
                          setOpenRowActions((current) =>
                            toggleProfileActionMenu(current, {
                              tool,
                              name: selectedProfileEntry.name,
                              scope: "inspector",
                            }),
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
                          aria-label={PROFILE_PANEL_COPY.actionMenuAriaLabel}
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
                              onClick={() =>
                                handleProfileAction(action, {
                                  tool,
                                  name: selectedProfileEntry.name,
                                })
                              }
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
                      label: PROFILE_INSPECTOR_FIELD_LABELS.liveMatch,
                      value: profileLiveMatchLabel(selectedProfileInspectorState.state),
                    },
                    {
                      label: PROFILE_INSPECTOR_FIELD_LABELS.authentication,
                      value: profileAuthMethodLabel(selectedProfileEntry.auth),
                    },
                    {
                      label: PROFILE_INSPECTOR_FIELD_LABELS.credentialStorage,
                      value:
                        snapshot.profiles[tool]?.active === selectedProfileEntry.name
                          ? formatCredentialBackendLabel(toolStatus?.credential_backend, "inventory")
                          : selectedInventoryEntry?.backend ?? BACKEND_UNAVAILABLE_LABEL,
                    },
                    {
                      label: PROFILE_INSPECTOR_FIELD_LABELS.added,
                      value: profileAddedLabel(
                        selectedLatestBackup
                          ? formatDateTimeWithZone(
                              selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id,
                            )
                          : null,
                      ),
                    },
                    {
                      label: PROFILE_INSPECTOR_FIELD_LABELS.lastChecked,
                      value: selectedInventoryEntry?.lastChecked ?? profileLastCheckedLabel(null, selectedProfileInspectorState.isActive),
                    },
                    ...(!availableStateModes.length
                      ? [
                          {
                            label: PROFILE_INSPECTOR_FIELD_LABELS.stateMode,
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
                    <strong>{STATIC_STATE_MODE_LABEL}</strong>
                    <p className="state-mode-copy">
                      {STATIC_STATE_MODE_COPY}
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
                          {PROFILE_INSPECTOR_FIELD_LABELS.credentialsPresent}:{" "}
                          {profileStorageBooleanLabel(toolStatus?.credentials_present)}
                        </p>
                        <p className="inline-note">
                          {PROFILE_INSPECTOR_FIELD_LABELS.localPermissions}:{" "}
                          {profileStorageBooleanLabel(toolStatus?.permissions_ok)}
                        </p>
                        {toolStatus?.token_warning ? (
                          <p className="inline-note">
                            {PROFILE_INSPECTOR_FIELD_LABELS.tokenWarning}: {profileTokenWarningLabel(toolStatus)}
                          </p>
                        ) : null}
                        {toolStatus?.warnings.length ? (
                          <div className="stack-list">
                            {toolStatus.warnings.map((warning, index) => (
                              <p
                                key={`${warning.code ?? warning.message ?? "warning"}-${index}`}
                                className="inline-note"
                              >
                                {PROFILE_INSPECTOR_FIELD_LABELS.warningPrefix}: {profileWarningLabel(warning)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="inline-note">
                        {PROFILE_PANEL_COPY.inactiveStorageDetail}
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="profiles-empty-state profiles-empty-state-inspector">
                <h3>{PROFILE_PANEL_COPY.emptyInspectorHeading}</h3>
                <p className="inline-note">{PROFILE_PANEL_COPY.emptyInspectorDetail}</p>
              </div>
            )}
          </aside>
        ) : null}
      />
      {editSheetState ? (
        <DialogSurface
          ariaLabel={PROFILE_EDIT_SHEET_COPY.ariaLabel}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="input:not([disabled]), button:not([disabled])"
          onClose={() => setPendingEdit(null)}
        >
          <div className="quick-switch-header">
            <div>
              <p className="card-kicker">{PROFILE_EDIT_SHEET_COPY.kicker}</p>
              <h3>{PROFILE_EDIT_SHEET_COPY.heading}</h3>
            </div>
          </div>
          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              const nextName = editSheetState.renameDraft.trim();
              const nextLabel = editSheetState.labelDraft.trim();
              if (editSheetState.renameDuplicate) {
                return;
              }

              if (nextName && nextName !== editSheetState.profile.name) {
                renameProfileMutation.mutate({
                  tool,
                  oldName: editSheetState.profile.name,
                  newName: nextName,
                });
              }

              const labelUpdateRequest = buildProfileLabelUpdateRequest({
                settings,
                tool,
                profileName: editSheetState.profile.name,
                profileLabel: editSheetState.profile.label,
                nextLabel,
              });
              if (labelUpdateRequest) {
                updateSettingsMutation.mutate(labelUpdateRequest);
              }

              setPendingEdit(null);
            }}
          >
            <label>
              {PROFILE_EDIT_SHEET_COPY.currentNameLabel}
              <input value={editSheetState.profile.name} disabled />
            </label>
            <label>
              {PROFILE_EDIT_SHEET_COPY.newNameLabel}
              <input
                ref={renameInputRef}
                aria-label={`rename ${editSheetState.profile.name}`}
                value={editSheetState.renameDraft}
                onChange={(event) =>
                  setRenameDrafts((current) => ({
                    ...current,
                    [editSheetState.profile.name]: event.target.value,
                  }))
                }
              />
            </label>
            {editSheetState.renameDuplicate ? (
              <p className="inline-note">
                {duplicateProfileNameWarning(tool, editSheetState.renameDraft.trim())}
              </p>
            ) : null}
            <label>
              {PROFILE_EDIT_SHEET_COPY.displayLabelLabel}
              <input
                ref={editLabelInputRef}
                aria-label={`label ${editSheetState.profile.name}`}
                value={editSheetState.labelDraft}
                onChange={(event) =>
                  setLabelDrafts((current) => ({
                    ...current,
                    [editSheetState.profile.name]: event.target.value,
                  }))
                }
              />
            </label>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setPendingEdit(null)}>
                {PROFILE_EDIT_SHEET_COPY.cancelLabel}
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={mutationLock.isBusy || Boolean(editSheetState.renameDuplicate)}
              >
                {PROFILE_EDIT_SHEET_COPY.saveLabel}
              </button>
            </div>
          </form>
        </DialogSurface>
      ) : null}
      {removalSheetState ? (
        <DialogSurface
          ariaLabel={PROFILE_REMOVAL_SHEET_COPY.ariaLabel}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingRemoval(null)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{PROFILE_REMOVAL_SHEET_COPY.kicker}</p>
                <h3>{buildProfileRemovalHeading(removalSheetState.display)}</h3>
              </div>
            </div>
            <p className="inline-note">
              {PROFILE_REMOVAL_SHEET_COPY.warning}
            </p>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => setPendingRemoval(null)}>
                  {PROFILE_REMOVAL_SHEET_COPY.cancelLabel}
                </button>
                <button
                  className="ghost-button danger-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() => {
                    setPendingRemoval(null);
                    removeProfileMutation.mutate({
                      tool,
                      profile: removalSheetState.profile.name,
                      force: snapshot.profiles[tool]?.active === removalSheetState.profile.name,
                    });
                  }}
                >
                  {PROFILE_REMOVAL_SHEET_COPY.confirmLabel}
                </button>
              </div>
            </footer>
        </DialogSurface>
      ) : null}
      {profileSheetOpen ? (
        <DialogSurface
          ariaLabel={PROFILE_PANEL_COPY.addProfileLabel}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="select:not([disabled]), input:not([disabled]), button:not([disabled])"
          onClose={() => setProfileSheetOpen(false)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{PROFILE_PANEL_COPY.addProfileLabel}</p>
                <h3>{PROFILE_ADD_SHEET_COPY.heading}</h3>
              </div>
            </div>
            <form className="stacked-form" onSubmit={submit}>
              <label>
                {PROFILE_ADD_SHEET_COPY.toolLabel}
                <select
                  value={tool}
                  onChange={(event) => {
                    setTool(normalizeProfileSheetTool(event.target.value, tool));
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
                {PROFILE_ADD_SHEET_COPY.profileNameLabel}
                <input value={profile} onChange={(event) => setProfile(event.target.value)} />
              </label>
              {hasDuplicateProfileName ? (
                <p className="inline-note">
                  {duplicateProfileNameWarning(tool, duplicateDraftName)}
                </p>
              ) : null}
              <label>
                {PROFILE_ADD_SHEET_COPY.displayLabelLabel}
                <input value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <label>
                {PROFILE_ADD_SHEET_COPY.authenticationLabel}
                <select
                  aria-label={PROFILE_ADD_SHEET_COPY.importModeAriaLabel}
                  value={mode}
                  onChange={(event) =>
                    setMode(
                      normalizeProfileSheetImportMode(
                        event.target.value,
                        availableImportModes,
                        mode,
                      ),
                    )
                  }
                >
                  {availableImportModes.map((entry) => (
                    <option key={entry} value={entry}>
                      {profileImportModeLabel(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profiles-sheet-note">
                <p className="card-kicker">{PROFILE_ADD_SHEET_COPY.modeKicker}</p>
                <h4>{profileImportModeHeading(tool, mode)}</h4>
                {profileImportModeNotes(tool, mode).map((note) => (
                  <p key={note} className="inline-note">
                    {note}
                  </p>
                ))}
              </div>
              <label>
                {PROFILE_ADD_SHEET_COPY.credentialBackendLabel}
                <select
                  value={credentialBackend}
                  onChange={(event) =>
                    setCredentialBackend(
                      normalizeProfileSheetCredentialBackend(
                        event.target.value,
                        availableCredentialBackends,
                        credentialBackend,
                      ),
                    )
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
                  {buildProfileFileBackendNote(tool)}
                </p>
              ) : null}
              {mode === "api_key" ? (
                <label>
                  {PROFILE_ADD_SHEET_COPY.apiKeyLabel}
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
                  {PROFILE_ADD_SHEET_COPY.expectedEnvVarPrefix} <code>{toolApiKeyEnvVar(tool)}</code>
                </p>
              ) : null}
              {mode === "oauth" ? (
                <div className="diagnostic-card">
                  <h4>{PROFILE_ADD_SHEET_COPY.oauthFlowHeading}</h4>
                  <p className="inline-note">
                    {PROFILE_ADD_SHEET_COPY.oauthFlowPrimaryNote}
                  </p>
                  <p className="inline-note">
                    {PROFILE_ADD_SHEET_COPY.oauthFlowSecondaryNote}
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
                  <strong>{STATIC_STATE_MODE_LABEL}</strong>
                  <p className="state-mode-copy">
                    {STATIC_STATE_MODE_COPY}
                  </p>
                </div>
              )}
              {mode === "oauth" ? (
                <article className="diagnostic-card">
                  <h4>{PROFILE_ADD_SHEET_COPY.oauthProgressHeading}</h4>
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
                      {PROFILE_ADD_SHEET_COPY.oauthProgressEmptyNote}
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
                  {PROFILE_ADD_SHEET_COPY.cancelLabel}
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
                  {buildProfileSheetSubmitLabel({
                    mode,
                    addProfilePending: addProfileMutation.isPending,
                    addProfileOAuthPending: addProfileOAuthMutation.isPending,
                    apiKeyPending: apiKeyProfileAction.isPending,
                  })}
                </button>
              </div>
              {mutationErrorMessage ? <p className="inline-note">{mutationErrorMessage}</p> : null}
            </form>
        </DialogSurface>
      ) : null}
    </div>
  );
}
