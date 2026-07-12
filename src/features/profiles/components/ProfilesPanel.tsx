import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SearchField } from "../../../components/SearchField";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import {
  AppBootstrap,
  AppSnapshot,
  DesktopSettings,
  type OAuthProgressEvent,
} from "../../../lib/schemas";
import { compareBackupsNewestFirst } from "../../../lib/backups";
import { DesktopCommandError } from "../../../lib/tauri";
import { listenDesktopEvent } from "../../../lib/tauri";
import { listBackups, parseOAuthProgressEvent } from "../../../lib/client";
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
import { resolveStateModeRequest, supportedStateModes } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { StateModeField } from "../../shared/components/StateModeField";

const TOOLS = ["claude", "codex", "gemini"] as const;
const INVENTORY_FILTERS = ["all", ...TOOLS] as const;

type InventoryFilter = (typeof INVENTORY_FILTERS)[number];
type InventoryEntry = {
  tool: (typeof TOOLS)[number];
  name: string;
  auth: string;
  label: string;
  active: boolean;
  backend: string;
  state: string;
  lastChecked: string;
};

export function ProfilesPanel({
  snapshot,
  settings,
  toolCapabilities,
  initialTool,
  initialExpandedProfile,
  initialMode,
  initialCredentialBackend,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  initialTool?: string;
  initialExpandedProfile?: string | null;
  initialMode?: ProfileImportMode;
  initialCredentialBackend?: "file" | "system-keyring" | null;
}) {
  const {
    addProfileMutation,
    addProfileOAuthMutation,
    useProfileMutation,
    renameProfileMutation,
    removeProfileMutation,
    restoreBackupMutation,
    updateSettingsMutation,
    apiKeyProfileAction,
    mutationLock,
  } = useDesktopActions();
  const [tool, setTool] = useState<(typeof TOOLS)[number]>(
    isSupportedTool(initialTool) ? initialTool : "claude",
  );
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>(
    isSupportedTool(initialTool) ? initialTool : "claude",
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
  const [pendingRestore, setPendingRestore] = useState<{
    profile: string;
    mode: "files" | "activate";
  } | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [openDiagnosticDetails, setOpenDiagnosticDetails] = useState<string | null>(null);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [openRowActions, setOpenRowActions] = useState<{
    tool: (typeof TOOLS)[number];
    name: string;
  } | null>(null);
  const [focusRenameOnSelection, setFocusRenameOnSelection] = useState(false);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

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
          backend: status?.credential_backend ? formatBackendLabel(status.credential_backend) : "Stored",
          state: status?.active_profile_applied === false ? "Drifted" : snapshot.profiles[entryTool]?.active === entry.name ? "Active" : "Stored",
          lastChecked: latestBackup
            ? formatBackupTimestamp(latestBackup.created_at ?? latestBackup.backup_id)
            : snapshot.profiles[entryTool]?.active === entry.name
              ? "Just now"
              : "Available locally",
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
  const selectedRenameDraft = selectedProfileEntry ? renameDrafts[selectedProfileEntry.name] ?? "" : "";
  const selectedRenameDuplicate =
    selectedProfileEntry &&
    selectedRenameDraft.trim().length > 0 &&
    isDuplicateProfileName(profiles, selectedProfileEntry.name, selectedRenameDraft);
  const selectedRestoreTargetDisplay =
    selectedProfileEntry && selectedProfileDisplay
      ? `${titleCase(tool)} / ${selectedProfileDisplay}`
      : null;
  const isPendingRestoreFiles =
    selectedProfileEntry &&
    pendingRestore?.profile === selectedProfileEntry.name &&
    pendingRestore.mode === "files";
  const isPendingRestoreAndActivate =
    selectedProfileEntry &&
    pendingRestore?.profile === selectedProfileEntry.name &&
    pendingRestore.mode === "activate";
  const activeProfilesCount = inventoryProfiles.filter((entry) => entry.active).length;
  const filteredActiveProfilesCount = filteredInventoryProfiles.filter((entry) => entry.active).length;
  const currentToolActiveProfile =
    snapshot.profiles[tool]?.active
      ? effectiveLabel(
          tool,
          snapshot.profiles[tool]?.active ?? "",
          snapshot.profiles[tool]?.profiles.find((entry) => entry.name === snapshot.profiles[tool]?.active)?.label,
          settings,
        ) ?? titleCase(snapshot.profiles[tool]?.active ?? "")
      : "None";
  const currentToolStatusLabel =
    snapshot.profiles[tool]?.active
      ? profileStatusSummary(snapshot, tool, snapshot.profiles[tool]?.active ?? "", toolStatus)
      : "Not configured";
  const currentToolBackend =
    toolStatus?.credential_backend
      ? formatBackendLabel(toolStatus.credential_backend)
      : "Stored";
  const restoreSheetMode = pendingRestore?.mode ?? null;
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
    setOpenDiagnosticDetails(initialExpandedProfile ?? null);
  }, [initialExpandedProfile, initialTool]);

  useEffect(() => {
    if (
      initialExpandedProfile == null &&
      (isSupportedTool(initialTool) || Boolean(initialMode) || Boolean(initialCredentialBackend))
    ) {
      setProfileSheetOpen(true);
    }
  }, [initialCredentialBackend, initialExpandedProfile, initialMode, initialTool]);

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
    if (!focusRenameOnSelection || !selectedProfileEntry) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
    setFocusRenameOnSelection(false);
  }, [focusRenameOnSelection, selectedProfileEntry]);

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
    setOpenDiagnosticDetails(null);
    setExpandedDetails(name);
  }

  function activateInventoryEntry(entry: InventoryEntry) {
    useProfileMutation.mutate({
      tool: entry.tool,
      profile: entry.name,
      stateMode: supportedStateModes(entry.tool, toolCapabilities).length ? stateMode : null,
      label: entry.label,
    });
  }

  return (
    <SectionCard
      title="Profiles"
      kicker="Saved profiles"
      actions={
        <div className="profiles-toolbar">
          <SearchField
            className="search-field profiles-search-field"
            inputClassName="search-field-input profiles-search"
            ariaLabel="Search Profiles"
            placeholder="Search profiles"
            value={search}
            onChange={setSearch}
          />
          <SegmentedControl
            ariaLabel="Profile filters"
            options={INVENTORY_FILTERS.map((entry) => ({
              value: entry,
              label: entry === "all" ? "All" : titleCase(entry),
            }))}
            value={inventoryFilter}
            onChange={setInventoryFilter}
          />
          <button
            className="primary-button"
            type="button"
            onClick={() => setProfileSheetOpen(true)}
          >
            Add Profile
          </button>
        </div>
      }
    >
      <SplitView
        className="profiles-layout"
        primaryClassName="profiles-inventory-pane"
        secondaryClassName="profiles-inspector-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card profiles-table-card">
              <div className="desktop-pane-section-header profiles-table-header">
                <div>
                  <p className="card-kicker">Inventory</p>
                  <h3>Saved profiles</h3>
                  <p className="inline-note">
                    Use the table like a native profile library: select a row to inspect it, or double-click to switch immediately.
                  </p>
                </div>
                <span className={`pill ${activeProfilesCount ? "pill-ok" : "pill-soft"}`}>
                  {activeProfilesCount ? `${activeProfilesCount} active` : "No active profiles"}
                </span>
              </div>
              <div className="profiles-library-summary">
                <div>
                  <span className="overview-current-set-cell-label">Visible</span>
                  <strong>{filteredInventoryProfiles.length} row{filteredInventoryProfiles.length === 1 ? "" : "s"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Current tool</span>
                  <strong>{toolDisplayName(tool)}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Active in view</span>
                  <strong>{filteredActiveProfilesCount}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Current profile</span>
                  <strong>{currentToolActiveProfile}</strong>
                </div>
              </div>
              <div className="profiles-list-header" aria-hidden="true">
                <span>Name</span>
                <span>Tool</span>
                <span>Auth</span>
                <span>Backend</span>
                <span>State</span>
                <span>Last checked</span>
                <span>Actions</span>
              </div>
              <div className="stack-list desktop-list-stack profiles-table-rows">
              {filteredInventoryProfiles.map((inventoryEntry) => (
                <div
                  key={`${inventoryEntry.tool}:${inventoryEntry.name}`}
                  className={`list-row profile-list-row ${
                    inventoryEntry.active ? "profile-list-row-active" : ""
                  } ${
                    expandedDetails === inventoryEntry.name && tool === inventoryEntry.tool
                      ? "profile-list-row-selected"
                      : ""
                  }`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name);
                    setOpenRowActions({ tool: inventoryEntry.tool, name: inventoryEntry.name });
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Inspect ${titleCase(inventoryEntry.tool)} ${inventoryEntry.label}`}
                    className="profile-list-row-button"
                    onClick={() => selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name)}
                    onDoubleClick={() => activateInventoryEntry(inventoryEntry)}
                  >
                    <div className="profile-list-main">
                      <div className="profile-list-row-title">
                        <span
                          className={`health-dot health-dot-${
                            inventoryEntry.state === "Drifted"
                              ? "warning"
                              : inventoryEntry.active
                                ? "ok"
                                : "neutral"
                          }`}
                          aria-hidden="true"
                        />
                        <strong>{inventoryEntry.label}</strong>
                        {inventoryEntry.active ? <span className="pill pill-ok">Active</span> : null}
                      </div>
                      <p>{inventoryEntry.name}</p>
                    </div>
                    <div className="profile-list-columns">
                      <span>{titleCase(inventoryEntry.tool)}</span>
                      <span>{inventoryEntry.auth}</span>
                      <span>{inventoryEntry.backend}</span>
                      <span>{inventoryEntry.state}</span>
                      <span>{inventoryEntry.lastChecked}</span>
                    </div>
                    <span className="profile-list-row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                  <div className="profile-row-actions" data-profile-row-actions>
                    <button
                      className="ghost-button profile-row-actions-trigger"
                      type="button"
                      aria-label={`Open actions for ${titleCase(inventoryEntry.tool)} ${inventoryEntry.label}`}
                      aria-expanded={
                        openRowActions?.tool === inventoryEntry.tool &&
                        openRowActions?.name === inventoryEntry.name
                      }
                      onClick={() => {
                        selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name);
                        setOpenRowActions((current) =>
                          current?.tool === inventoryEntry.tool && current?.name === inventoryEntry.name
                            ? null
                            : { tool: inventoryEntry.tool, name: inventoryEntry.name },
                        );
                      }}
                    >
                      •••
                    </button>
                    {openRowActions?.tool === inventoryEntry.tool &&
                    openRowActions?.name === inventoryEntry.name ? (
                      <div className="profile-row-actions-menu" role="menu" aria-label="Profile row actions">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name);
                            setOpenRowActions(null);
                          }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={mutationLock.isBusy}
                          onClick={() => {
                            setOpenRowActions(null);
                            activateInventoryEntry(inventoryEntry);
                          }}
                        >
                          Switch to this profile
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name);
                            setOpenRowActions(null);
                            setFocusRenameOnSelection(true);
                          }}
                        >
                          Rename…
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="profile-row-actions-danger"
                          onClick={() => {
                            selectInventoryEntry(inventoryEntry.tool, inventoryEntry.name);
                            setOpenRowActions(null);
                            setPendingRemoval(inventoryEntry.name);
                          }}
                        >
                          Remove…
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {!filteredInventoryProfiles.length ? (
                <article className="diagnostic-card">
                  <h3>No matching profiles</h3>
                  <p className="inline-note">
                    Adjust the tool filter or search query, or add a new profile from the inspector.
                  </p>
                </article>
              ) : null}
              </div>
            </article>
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
          <div className="stack-list">
            {selectedProfileEntry ? (
              <>
                <article className="diagnostic-card profiles-inspector-card">
                  <div className="profiles-tool-focus-main">
                    <div className="stack-list">
                      <div className="profiles-tool-focus-header">
                        <div>
                          <p className="card-kicker">Inspector</p>
                          <h3>{titleCase(tool)} / {selectedProfileDisplay}</h3>
                          <p className="inline-note">
                            Review the current saved login, confirm live match, and switch or recover from one focused pane.
                          </p>
                        </div>
                        <span
                          className={`pill ${
                            snapshot.profiles[tool]?.active === selectedProfileEntry.name
                              ? toolStatus?.active_profile_applied === false
                                ? "pill-warn"
                                : "pill-ok"
                              : "pill-soft"
                          }`}
                        >
                          {profileStatusSummary(snapshot, tool, selectedProfileEntry.name, toolStatus)}
                        </span>
                      </div>
                      <div className="profiles-tool-focus-grid">
                        <div>
                          <span className="overview-current-set-cell-label">Current tool</span>
                          <strong>{titleCase(tool)}</strong>
                        </div>
                        <div>
                          <span className="overview-current-set-cell-label">Active profile</span>
                          <strong>{currentToolActiveProfile}</strong>
                        </div>
                        <div>
                          <span className="overview-current-set-cell-label">Backend</span>
                          <strong>{currentToolBackend}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="profiles-inspector-rail">
                      <div className="profiles-inspector-controls">
                        <label>
                          Current tool
                          <select
                            value={tool}
                            onChange={(event) => {
                              setTool(event.target.value as typeof tool);
                              setOpenDiagnosticDetails(null);
                              setExpandedDetails(null);
                            }}
                          >
                            {TOOLS.map((entry) => (
                              <option key={entry} value={entry}>
                                {titleCase(entry)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {availableStateModes.length ? (
                          <StateModeField
                            name={`inspector-state-mode-${tool}`}
                            value={stateMode}
                            options={availableStateModes}
                            onChange={setStateMode}
                          />
                        ) : (
                          <label>
                            State mode
                            <select value="n/a" disabled>
                              <option value="n/a">Not configurable</option>
                            </select>
                          </label>
                        )}
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => setProfileSheetOpen(true)}
                        >
                          + Add Profile
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="profiles-detail-meta">
                    <div>
                      <span className="overview-current-set-cell-label">Stored name</span>
                      <strong>{selectedProfileEntry.name}</strong>
                    </div>
                    <div>
                      <span className="overview-current-set-cell-label">Auth method</span>
                      <strong>{selectedProfileEntry.auth}</strong>
                    </div>
                    <div>
                      <span className="overview-current-set-cell-label">Latest backup</span>
                      <strong>
                        {selectedLatestBackup
                          ? formatBackupTimestamp(selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id)
                          : "No backup yet"}
                      </strong>
                    </div>
                  </div>
                  <KeyValueGrid
                    rows={[
                      {
                        label: "Active profile",
                        value:
                          snapshot.profiles[tool]?.active === selectedProfileEntry.name ? "Yes" : "No",
                      },
                      {
                        label: "Live match",
                        value: profileLiveMatchValue(snapshot, tool, selectedProfileEntry.name, toolStatus),
                      },
                      {
                        label: "Auth method",
                        value: selectedProfileEntry.auth,
                      },
                      {
                        label: "Credential backend",
                        value:
                          snapshot.profiles[tool]?.active === selectedProfileEntry.name
                            ? toolStatus?.credential_backend ?? "unknown"
                            : selectedInventoryEntry?.backend ?? "Stored",
                      },
                      {
                        label: "State mode",
                        value:
                          snapshot.profiles[tool]?.active === selectedProfileEntry.name
                            ? toolStatus?.state_mode ?? "n/a"
                            : selectedInventoryEntry?.state ?? "Stored",
                      },
                      {
                        label: "Last checked",
                        value: selectedInventoryEntry?.lastChecked ?? "Available locally",
                      },
                    ]}
                  />
                  <p className="inline-note">
                    Keep this profile ready for switching by checking live match, backend health, and recent backup state before you start coding.
                  </p>
                  <div className="desktop-pane-section-header profiles-inspector-section-header">
                    <div>
                      <p className="card-kicker">Manage</p>
                      <h4>Actions</h4>
                    </div>
                    <p className="inline-note">
                      Switch, restore, rename, relabel, inspect diagnostics, and remove this saved profile without leaving the inspector.
                    </p>
                  </div>
                  <div className="button-row">
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
                      Switch to this profile
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        setOpenDiagnosticDetails((current) =>
                          current === selectedProfileEntry.name ? null : selectedProfileEntry.name,
                        )
                      }
                    >
                      {openDiagnosticDetails === selectedProfileEntry.name
                        ? "Hide technical details"
                        : "Show technical details"}
                    </button>
                  </div>
                  {selectedLatestBackup ? (
                    <div className="button-row profiles-restore-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          setPendingRestore({
                            profile: selectedProfileEntry.name,
                            mode: "files",
                          })
                        }
                      >
                        Restore latest
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          setPendingRestore({
                            profile: selectedProfileEntry.name,
                            mode: "activate",
                          })
                        }
                      >
                        Restore latest + activate
                      </button>
                    </div>
                  ) : null}
                  <div className="profiles-management-grid profiles-inspector-sections">
                    <div className="profiles-management-block">
                      <p className="card-kicker">Name</p>
                      <h4>Rename profile</h4>
                      <p className="inline-note">
                        Keep the stable profile name predictable for switching and recovery.
                      </p>
                      <div className="inline-form inline-form-compact">
                        <input
                          ref={renameInputRef}
                          aria-label={`rename ${selectedProfileEntry.name}`}
                          placeholder="new name"
                          value={selectedRenameDraft}
                          onChange={(event) =>
                            setRenameDrafts((current) => ({
                              ...current,
                              [selectedProfileEntry.name]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={mutationLock.isBusy || Boolean(selectedRenameDuplicate)}
                          onClick={() => {
                            const newName = selectedRenameDraft.trim();
                            if (!newName) return;
                            setPendingRemoval(null);
                            renameProfileMutation.mutate({
                              tool,
                              oldName: selectedProfileEntry.name,
                              newName,
                            });
                          }}
                        >
                          Rename
                        </button>
                      </div>
                      {selectedRenameDuplicate ? (
                        <p className="inline-note">
                          {duplicateWarning(tool, selectedRenameDraft.trim())}
                        </p>
                      ) : null}
                    </div>
                    <div className="profiles-management-block">
                      <p className="card-kicker">Label</p>
                      <h4>Relabel profile</h4>
                      <p className="inline-note">
                        Keep the visible profile label readable without changing the stored name.
                      </p>
                      <div className="inline-form inline-form-compact">
                        <input
                          aria-label={`label ${selectedProfileEntry.name}`}
                          placeholder="display label"
                          value={
                            labelDrafts[selectedProfileEntry.name] ??
                            effectiveLabel(tool, selectedProfileEntry.name, selectedProfileEntry.label, settings) ??
                            ""
                          }
                          onChange={(event) =>
                            setLabelDrafts((current) => ({
                              ...current,
                              [selectedProfileEntry.name]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={mutationLock.isBusy}
                          onClick={() => {
                            const nextLabel = labelDrafts[selectedProfileEntry.name]?.trim() ?? "";
                            setPendingRemoval(null);
                            updateSettingsMutation.mutate({
                              runtime_kind: settings.runtime_kind,
                              runtime_path: settings.runtime_path ?? null,
                              aisw_home: settings.aisw_home ?? null,
                              update_channel: settings.update_channel,
                              profile_sets: settings.profile_sets,
                              profile_labels: mergeProfileLabel(
                                settings,
                                tool,
                                selectedProfileEntry.name,
                                nextLabel || null,
                              ),
                            });
                          }}
                        >
                          Relabel
                        </button>
                      </div>
                    </div>
                  </div>
                  {openDiagnosticDetails === selectedProfileEntry.name ? (
                    <div className="profiles-technical-block profiles-inspector-section">
                      <p className="card-kicker">Diagnostics</p>
                      <h4>Technical details</h4>
                      <p className="inline-note">
                        Auth method: {selectedProfileEntry.auth}
                      </p>
                      <p className="inline-note">
                        Desktop active: {snapshot.profiles[tool]?.active === selectedProfileEntry.name ? "yes" : "no"}
                      </p>
                      {selectedLatestBackup ? (
                        <p className="inline-note">
                          Latest restore point: {formatBackupTimestamp(selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id)}
                        </p>
                      ) : null}
                      {snapshot.profiles[tool]?.active === selectedProfileEntry.name ? (
                        <>
                          <p className="inline-note">
                            Credential backend: {toolStatus?.credential_backend ?? "unknown"}
                          </p>
                          <p className="inline-note">
                            Live match:{" "}
                            {toolStatus?.active_profile_applied === undefined ||
                            toolStatus?.active_profile_applied === null
                              ? "unknown"
                              : toolStatus.active_profile_applied
                                ? "yes"
                                : "no"}
                          </p>
                          <p className="inline-note">
                            Credentials present:{" "}
                            {toolStatus?.credentials_present === undefined ||
                            toolStatus?.credentials_present === null
                              ? "unknown"
                              : toolStatus.credentials_present
                                ? "yes"
                                : "no"}
                          </p>
                          <p className="inline-note">
                            Permissions OK:{" "}
                            {toolStatus?.permissions_ok === undefined || toolStatus?.permissions_ok === null
                              ? "unknown"
                              : toolStatus.permissions_ok
                                ? "yes"
                                : "no"}
                          </p>
                          {toolStatus?.token_warning ? (
                            <p className="inline-note">
                              Token warning: {formatProfileTokenWarning(toolStatus)}
                            </p>
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
                          {!toolStatus?.token_warning && !toolStatus?.warnings.length ? (
                            <p className="inline-note">
                              No additional token or runtime warnings are currently reported for this tool.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="inline-note">
                          Live runtime diagnostics are only available for the active profile. Switch to this profile to inspect backend, live-match, token, and permission state.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <div className="profiles-management-block profiles-inspector-section">
                    <p className="card-kicker">Removal</p>
                    <h4>Remove profile</h4>
                    <p className="inline-note">
                      Removing an active profile requires an extra confirmation before the saved login is deleted.
                    </p>
                    <div className="button-row">
                      {snapshot.profiles[tool]?.active === selectedProfileEntry.name ? (
                        <button
                          className="ghost-button danger-button"
                          type="button"
                          onClick={() => setPendingRemoval(selectedProfileEntry.name)}
                        >
                          Remove active…
                        </button>
                      ) : (
                        <button
                          className="ghost-button danger-button"
                          type="button"
                          onClick={() => setPendingRemoval(selectedProfileEntry.name)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              </>
            ) : (
              <article className="diagnostic-card profiles-inspector-card">
                <div className="profiles-tool-focus-main">
                  <div className="stack-list">
                    <div className="profiles-tool-focus-header">
                      <div>
                        <p className="card-kicker">Inspector</p>
                        <h3>{titleCase(tool)} profiles</h3>
                        <p className="inline-note">
                          Select a saved profile from the library to inspect activation state, health details, backups, and edit actions.
                        </p>
                      </div>
                      <span
                        className={`pill ${
                          currentToolStatusLabel === "Active"
                            ? "pill-ok"
                            : currentToolStatusLabel === "Live mismatch"
                              ? "pill-warn"
                              : "pill-soft"
                        }`}
                      >
                        {currentToolStatusLabel}
                      </span>
                    </div>
                    <div className="profiles-tool-focus-grid">
                      <div>
                        <span className="overview-current-set-cell-label">Current tool</span>
                        <strong>{titleCase(tool)}</strong>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Active profile</span>
                        <strong>{currentToolActiveProfile}</strong>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Backend</span>
                        <strong>{currentToolBackend}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="profiles-inspector-rail">
                    <div className="profiles-inspector-controls">
                      <label>
                        Current tool
                        <select
                          value={tool}
                          onChange={(event) => {
                            setTool(event.target.value as typeof tool);
                            setOpenDiagnosticDetails(null);
                            setExpandedDetails(null);
                          }}
                        >
                          {TOOLS.map((entry) => (
                            <option key={entry} value={entry}>
                              {titleCase(entry)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {availableStateModes.length ? (
                        <StateModeField
                          name={`inspector-state-mode-${tool}`}
                          value={stateMode}
                          options={availableStateModes}
                          onChange={setStateMode}
                        />
                      ) : (
                        <label>
                          State mode
                          <select value="n/a" disabled>
                            <option value="n/a">Not configurable</option>
                          </select>
                        </label>
                      )}
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => setProfileSheetOpen(true)}
                      >
                        + Add Profile
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )}
            {!profiles.length ? <p className="inline-note">No profiles stored for this tool yet.</p> : null}
          </div>
          </div>
        }
      />
      {selectedProfileEntry && selectedLatestBackup && selectedRestoreTargetDisplay && restoreSheetMode ? (
        <DialogSurface
          ariaLabel="Restore Latest Backup"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingRestore(null)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Backup</p>
                <h3>Restore latest backup?</h3>
                <p className="inline-note">
                  Review the restore scope before AI Switch changes any saved files.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setPendingRestore(null)}>
                Close
              </button>
            </div>
            <KeyValueGrid
              rows={[
                { label: "Target", value: selectedRestoreTargetDisplay },
                {
                  label: "Created",
                  value: formatBackupTimestamp(selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id),
                },
                { label: "Backup ID", value: selectedLatestBackup.backup_id },
              ]}
            />
            {restoreSheetMode === "files" ? (
              <div className="stack-list">
                <p className="inline-note">
                  This restores the latest saved files for {selectedRestoreTargetDisplay}.
                </p>
                <p className="inline-note">
                  It will not activate this profile again until you switch to it explicitly.
                </p>
              </div>
            ) : (
              <div className="stack-list">
                <p className="inline-note">
                  This restores the latest saved files for {selectedRestoreTargetDisplay}.
                </p>
                <p className="inline-note">
                  It will also switch the live profile again after the restore completes.
                </p>
              </div>
            )}
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">Action</p>
                <strong>{restoreSheetMode === "files" ? "Restore latest" : "Restore latest + activate"}</strong>
                <p>
                  {restoreSheetMode === "files"
                    ? "Restore saved files only."
                    : "Restore saved files, then reactivate this profile."}
                </p>
              </div>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => setPendingRestore(null)}>
                  Cancel
                </button>
                <button
                  className={restoreSheetMode === "files" ? "ghost-button danger-button" : "primary-button"}
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() =>
                    restoreBackupMutation.mutate(selectedLatestBackup.backup_id, {
                      onSuccess: () => {
                        setPendingRestore(null);
                        if (restoreSheetMode === "activate") {
                          useProfileMutation.mutate({
                            tool,
                            profile: selectedProfileEntry.name,
                            stateMode: resolveStateModeRequest(tool, toolCapabilities, stateMode),
                            label: selectedProfileDisplay ?? selectedProfileEntry.name,
                          });
                        }
                      },
                    })
                  }
                >
                  {restoreSheetMode === "files" ? "Restore" : "Restore latest + activate"}
                </button>
              </div>
            </footer>
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
                <h3>Remove profile?</h3>
                <p className="inline-note">
                  This removes the saved login from AI Switch. Credential contents are never shown here.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setPendingRemoval(null)}>
                Close
              </button>
            </div>
            <KeyValueGrid
              rows={[
                { label: "Tool", value: titleCase(tool) },
                { label: "Profile", value: removalSheetDisplay },
                {
                  label: "Active profile",
                  value: snapshot.profiles[tool]?.active === removalSheetProfile.name ? "Yes" : "No",
                },
              ]}
            />
            <p className="inline-note">
              {snapshot.profiles[tool]?.active === removalSheetProfile.name
                ? "Removing the active profile affects the current desktop selection and needs explicit confirmation."
                : "This removes the saved profile from the local library only."}
            </p>
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">Action</p>
                <strong>
                  {snapshot.profiles[tool]?.active === removalSheetProfile.name
                    ? "Remove active profile"
                    : "Remove profile"}
                </strong>
              </div>
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
                  {snapshot.profiles[tool]?.active === removalSheetProfile.name
                    ? "Remove active profile"
                    : "Remove"}
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
              <button className="ghost-button" type="button" onClick={() => setProfileSheetOpen(false)}>
                Close
              </button>
            </div>
            <p className="inline-note">
              Capture a current login, start provider OAuth, paste an API key, or read from the environment in one focused flow.
            </p>
            <form className="stacked-form" onSubmit={submit}>
              <label>
                Tool
                <select
                  value={tool}
                  onChange={(event) => {
                    setTool(event.target.value as typeof tool);
                    setOpenDiagnosticDetails(null);
                    setExpandedDetails(null);
                  }}
                >
                  {TOOLS.map((entry) => (
                    <option key={entry} value={entry}>
                      {titleCase(entry)}
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
                Label
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
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Mode</p>
                    <h4>{profileImportModeHeading(tool, mode)}</h4>
                  </div>
                </div>
                {profileImportModeNotes(tool, mode).map((note) => (
                  <p key={note} className="inline-note">
                    {note}
                  </p>
                ))}
              </article>
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
                  {titleCase(tool)} profiles are always stored with file-backed credentials.
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
                  Expected environment variable: <code>{expectedEnvVar(tool)}</code>
                </p>
              ) : null}
              {mode === "oauth" ? (
                <div className="diagnostic-card">
                  <h4>Sign-in flow</h4>
                  <p className="inline-note">
                    AI Switch will launch the tool&apos;s native login flow and stream progress from the bundled runtime.
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
                />
              ) : (
                <label>
                  State mode
                  <select value="n/a" disabled>
                    <option value="n/a">Not configurable</option>
                  </select>
                </label>
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
    </SectionCard>
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
        `AI Switch will capture the credentials ${toolName} is already using and save them as the profile you name here.`,
        "This keeps the current login local while turning it into a reusable saved profile.",
      ];
    case "from_env":
      return [
        `AI Switch will read ${expectedEnvVar(tool)} when you save this profile.`,
        "Use this when the current shell or launch environment already has the provider key exported.",
      ];
    case "api_key":
      return [
        "Paste the provider key once and AI Switch will hand it to the bundled runtime over stdin instead of writing it into the form state.",
        "The saved profile stores the resulting local credentials only after the runtime confirms success.",
      ];
    case "oauth":
      return [
        `AI Switch will open the normal ${toolName} sign-in flow and capture the resulting local credentials after sign-in finishes.`,
        "Keep this sheet open while the browser or terminal login completes.",
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

function expectedEnvVar(tool: string) {
  switch (tool) {
    case "claude":
      return "ANTHROPIC_API_KEY";
    case "codex":
      return "OPENAI_API_KEY";
    case "gemini":
      return "GEMINI_API_KEY";
    default:
      return "API_KEY";
  }
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
  return "AI Switch could not complete that action.";
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

function profileLiveMatchValue(
  snapshot: AppSnapshot,
  tool: string,
  profileName: string,
  toolStatus: AppSnapshot["statuses"][number] | undefined,
) {
  if (snapshot.profiles[tool]?.active !== profileName) {
    return "Available after activation";
  }
  if (toolStatus?.active_profile_applied === undefined || toolStatus?.active_profile_applied === null) {
    return "Unknown";
  }
  return toolStatus.active_profile_applied ? "Yes" : "No";
}

function profileStatusSummary(
  snapshot: AppSnapshot,
  tool: string,
  profileName: string,
  toolStatus: AppSnapshot["statuses"][number] | undefined,
) {
  if (snapshot.profiles[tool]?.active !== profileName) {
    return "Stored";
  }
  if (toolStatus?.active_profile_applied === false) {
    return "Live mismatch";
  }
  return "Active";
}

function formatBackupTimestamp(value: string) {
  const isoDate = Date.parse(value);
  if (!Number.isNaN(isoDate)) {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(isoDate));
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (!match) {
    return "Unknown";
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
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
