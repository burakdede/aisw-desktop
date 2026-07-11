import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
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
import { titleCase } from "../../../lib/utils";
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
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <SectionCard
      title="Profiles"
      kicker="Provisioning"
      actions={
        <div className="profiles-toolbar">
          <input
            className="profiles-search"
            aria-label="Search Profiles"
            placeholder="Search profiles"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="segmented-control" role="tablist" aria-label="Profile filters">
            {INVENTORY_FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={
                  inventoryFilter === entry
                    ? "segmented-control-button segmented-control-button-active"
                    : "segmented-control-button"
                }
                aria-selected={inventoryFilter === entry}
                onClick={() => setInventoryFilter(entry)}
              >
                {entry === "all" ? "All" : titleCase(entry)}
              </button>
            ))}
          </div>
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
      <div className="panel-grid panel-grid-2 profiles-layout desktop-pane-grid">
        <div className="stack-list profiles-inventory-pane desktop-pane-column">
          <article className="diagnostic-card desktop-pane-intro">
            <h3>Saved profiles</h3>
            <p className="inline-note">
              Review active state, storage backend, and recent checks before you switch or edit a profile.
            </p>
          </article>
          <div className="desktop-pane-section">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Library</p>
                <h3>Saved profiles</h3>
              </div>
              <p className="inline-note">
                Double-click any row to focus it in the inspector.
              </p>
            </div>
            <div className="profiles-list-header" aria-hidden="true">
              <span>Name</span>
              <span>Tool</span>
              <span>Auth</span>
              <span>Backend</span>
              <span>State</span>
              <span>Last checked</span>
            </div>
          </div>
          {filteredInventoryProfiles.map((inventoryEntry) => (
            <article
              key={`${inventoryEntry.tool}:${inventoryEntry.name}`}
              className={`list-row profile-list-row ${
                inventoryEntry.active ? "profile-list-row-active" : ""
              } ${
                expandedDetails === inventoryEntry.name && tool === inventoryEntry.tool
                  ? "profile-list-row-selected"
                  : ""
              }`}
              onDoubleClick={() => {
                setTool(inventoryEntry.tool);
                setOpenDiagnosticDetails(null);
                setExpandedDetails(inventoryEntry.name);
              }}
            >
              <div className="profile-list-main">
                <strong>{inventoryEntry.label}</strong>
                <p>
                  {inventoryEntry.name} · {inventoryEntry.auth}
                </p>
              </div>
              <div className="profile-list-columns">
                <span>{titleCase(inventoryEntry.tool)}</span>
                <span>{inventoryEntry.auth}</span>
                <span>{inventoryEntry.backend}</span>
                <span>{inventoryEntry.state}</span>
                <span>{inventoryEntry.lastChecked}</span>
              </div>
              <div className="button-row">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setTool(inventoryEntry.tool);
                    useProfileMutation.mutate({
                      tool: inventoryEntry.tool,
                      profile: inventoryEntry.name,
                      stateMode: supportedStateModes(inventoryEntry.tool, toolCapabilities).length
                        ? stateMode
                        : null,
                      label: inventoryEntry.label,
                    });
                  }}
                  disabled={mutationLock.isBusy}
                >
                  Activate
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setTool(inventoryEntry.tool);
                    setOpenDiagnosticDetails(null);
                    setExpandedDetails((current) =>
                      current === inventoryEntry.name ? null : inventoryEntry.name,
                    );
                  }}
                >
                  {expandedDetails === inventoryEntry.name && tool === inventoryEntry.tool
                    ? "Close details"
                    : "Open details"}
                </button>
              </div>
            </article>
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
        <div className="stack-list profiles-inspector-pane desktop-pane-column">
          <article className="diagnostic-card desktop-pane-intro">
            <h3>Inspector</h3>
            <p className="inline-note">
              Review the selected profile, then open a focused sheet when you need to add a new login.
            </p>
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
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => setProfileSheetOpen(true)}>
                Add Profile
              </button>
            </div>
          </article>
          <div className="stack-list">
          {selectedProfileEntry ? (
            <article className="diagnostic-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Inspector</p>
                  <h3>{selectedProfileDisplay}</h3>
                </div>
                <p className="inline-note">
                  Review activation status, labels, backups, and safe recovery actions for this saved profile.
                </p>
              </div>
              <p className="inline-note">
                {selectedProfileEntry.name} · {selectedProfileEntry.auth}
              </p>
              <div className="kv-grid">
                <div className="kv-row">
                  <strong>Status</strong>
                  <span>{snapshot.profiles[tool]?.active === selectedProfileEntry.name ? "Active" : "Stored"}</span>
                </div>
                <div className="kv-row">
                  <strong>Live match</strong>
                  <span>
                    {snapshot.profiles[tool]?.active === selectedProfileEntry.name
                      ? toolStatus?.active_profile_applied === undefined ||
                        toolStatus?.active_profile_applied === null
                        ? "Unknown"
                        : toolStatus.active_profile_applied
                          ? "Yes"
                          : "No"
                      : "Available after activation"}
                  </span>
                </div>
                <div className="kv-row">
                  <strong>Credential backend</strong>
                  <span>
                    {snapshot.profiles[tool]?.active === selectedProfileEntry.name
                      ? toolStatus?.credential_backend ?? "unknown"
                      : selectedInventoryEntry?.backend ?? "Stored"}
                  </span>
                </div>
                <div className="kv-row">
                  <strong>Last checked</strong>
                  <span>{selectedInventoryEntry?.lastChecked ?? "Available locally"}</span>
                </div>
              </div>
              <div className="inline-form inline-form-compact">
                <input
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
                  Activate
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
                    : "View technical details"}
                </button>
              </div>
              {openDiagnosticDetails === selectedProfileEntry.name ? (
                <article className="diagnostic-card">
                  <h4>Technical details</h4>
                  <p className="inline-note">
                    Auth method: {selectedProfileEntry.auth}
                  </p>
                  <p className="inline-note">
                    Desktop active: {snapshot.profiles[tool]?.active === selectedProfileEntry.name ? "yes" : "no"}
                  </p>
                  {selectedLatestBackup ? (
                    <p className="inline-note">
                      Latest backup: {formatBackupTimestamp(selectedLatestBackup.created_at ?? selectedLatestBackup.backup_id)}
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
                      Live runtime diagnostics are only available for the active profile. Activate this
                      profile to verify backend, live-match, token, and permission state.
                    </p>
                  )}
                </article>
              ) : null}
              {selectedLatestBackup ? (
                <div className="button-row">
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
              {isPendingRestoreFiles ? (
                <>
                  <p className="inline-note">
                    Confirm before restoring the latest backup for {selectedRestoreTargetDisplay}. This replays the saved files only.
                  </p>
                  <div className="button-row">
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() =>
                        restoreBackupMutation.mutate(selectedLatestBackup!.backup_id, {
                          onSuccess: () => setPendingRestore(null),
                        })
                      }
                    >
                      Confirm restore latest
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setPendingRestore(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : null}
              {isPendingRestoreAndActivate ? (
                <>
                  <p className="inline-note">
                    Confirm before restoring and activating the latest backup for {selectedRestoreTargetDisplay}. This replays the backup and switches the live profile again.
                  </p>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() =>
                        restoreBackupMutation.mutate(selectedLatestBackup!.backup_id, {
                          onSuccess: () => {
                            setPendingRestore(null);
                            useProfileMutation.mutate({
                              tool,
                              profile: selectedProfileEntry.name,
                              stateMode: resolveStateModeRequest(tool, toolCapabilities, stateMode),
                              label: selectedProfileDisplay ?? selectedProfileEntry.name,
                            });
                          },
                        })
                      }
                    >
                      Confirm restore latest and activate
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setPendingRestore(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : null}
              <div className="button-row">
                {snapshot.profiles[tool]?.active === selectedProfileEntry.name ? (
                  pendingRemoval === selectedProfileEntry.name ? (
                    <>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => {
                          setPendingRemoval(null);
                          removeProfileMutation.mutate({
                            tool,
                            profile: selectedProfileEntry.name,
                            force: true,
                          });
                        }}
                      >
                        Confirm remove active
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setPendingRemoval(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      onClick={() => setPendingRemoval(selectedProfileEntry.name)}
                    >
                      Remove active…
                    </button>
                  )
                ) : (
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => {
                      setPendingRemoval(null);
                      removeProfileMutation.mutate({
                        tool,
                        profile: selectedProfileEntry.name,
                        force: false,
                      });
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          ) : (
            <article className="diagnostic-card">
              <h3>Profile details</h3>
              <p className="inline-note">
                Select a saved profile from the library to inspect activation state, health details, backups, and edit actions.
              </p>
            </article>
          )}
          {!profiles.length ? <p className="inline-note">No profiles stored for this tool yet.</p> : null}
          </div>
        </div>
      </div>
      {profileSheetOpen ? (
        <div className="quick-switch-overlay" role="presentation" onClick={() => setProfileSheetOpen(false)}>
          <section
            className="quick-switch-palette profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Add Profile"
            onClick={(event) => event.stopPropagation()}
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
                Import mode
                <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                  {availableImportModes.map((entry) => (
                    <option key={entry} value={entry}>
                      {profileImportModeLabel(entry)}
                    </option>
                  ))}
                </select>
              </label>
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
                    AI Switch will launch the tool&apos;s native login flow and stream progress from the bundled switching engine.
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
                      ? "Waiting for OAuth…"
                      : "Start OAuth"
                    : mode === "api_key"
                      ? apiKeyProfileAction.isPending
                        ? "Saving…"
                        : "Add profile"
                      : addProfileMutation.isPending
                        ? "Saving…"
                        : "Add profile"}
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
          </section>
        </div>
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
      return "Capture environment";
    case "api_key":
      return "API key via stdin";
    case "oauth":
      return "Guided OAuth capture";
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
      fallback: "AI Switch stores the captured profile and refreshes desktop state.",
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
    return error.remediation ? `${error.message} Remediation: ${error.remediation}` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    const remediation =
      "remediation" in error && typeof error.remediation === "string" ? error.remediation : undefined;
    return remediation ? `${error.message} Remediation: ${remediation}` : error.message;
  }
  return "Desktop command failed.";
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
