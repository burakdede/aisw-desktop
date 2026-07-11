import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DesktopStatusStrip } from "../../../components/DesktopStatusStrip";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import { listBackups } from "../../../lib/client";
import { compareBackupsNewestFirst } from "../../../lib/backups";
import { toolProfileDisplayLabel } from "../../../lib/profile-display";
import { AppBootstrap, AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { resolveStateModeRequest } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";

export function BackupsPanel({
  snapshot,
  settings,
  toolCapabilities,
  onOpenProfiles,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (tool: string, expandedProfile?: string | null) => void;
}) {
  const readEnabled = useMutationAwareQueryEnabled();
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups, enabled: readEnabled });
  const { restoreBackupMutation, useProfileMutation, mutationLock } = useDesktopActions();
  const [copyMessage, setCopyMessage] = useState("");
  const [pendingRestore, setPendingRestore] = useState<{
    backupId: string;
    mode: "files" | "activate";
  } | null>(null);
  const sortedBackups = useMemo(
    () => [...(backups.data ?? [])].sort(compareBackupsNewestFirst),
    [backups.data],
  );
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBackupId && sortedBackups.some((entry) => entry.backup_id === selectedBackupId)) {
      return;
    }
    setSelectedBackupId(sortedBackups[0]?.backup_id ?? null);
  }, [selectedBackupId, sortedBackups]);

  async function copyBackupId(backupId: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(`Clipboard access is unavailable. Copy backup id ${backupId} manually.`);
      return;
    }
    await navigator.clipboard.writeText(backupId);
    setCopyMessage(`Copied backup id ${backupId}.`);
  }

  function confirmRestore(entry: { backup_id: string; tool: string; profile: string }, mode: "files" | "activate") {
    const target = resolveBackupTarget(entry.tool, entry.profile);
    const profileLabel = toolProfileDisplayLabel(settings, snapshot, target.tool, target.profile);
    const preferredStateMode =
      snapshot.statuses.find((status) => status.tool === target.tool)?.state_mode ?? null;
    restoreBackupMutation.mutate(entry.backup_id, {
      onSuccess: () => {
        setPendingRestore(null);
        if (mode === "activate") {
          useProfileMutation.mutate({
            tool: target.tool,
            profile: target.profile,
            stateMode: resolveStateModeRequest(target.tool, toolCapabilities, preferredStateMode),
            label: profileLabel,
          });
        }
      },
    });
  }

  const selectedBackup =
    sortedBackups.find((entry) => entry.backup_id === selectedBackupId) ?? sortedBackups[0] ?? null;
  const selectedTarget = selectedBackup
    ? resolveBackupTarget(selectedBackup.tool, selectedBackup.profile)
    : null;
  const selectedProfileLabel =
    selectedBackup && selectedTarget
      ? toolProfileDisplayLabel(settings, snapshot, selectedTarget.tool, selectedTarget.profile)
      : null;
  const selectedTargetDisplay =
    selectedTarget && selectedProfileLabel
      ? `${titleCase(selectedTarget.tool)} / ${selectedProfileLabel}`
      : null;
  const selectedPendingFilesRestore =
    selectedBackup && pendingRestore?.backupId === selectedBackup.backup_id && pendingRestore.mode === "files";
  const selectedPendingRestoreAndActivate =
    selectedBackup && pendingRestore?.backupId === selectedBackup.backup_id && pendingRestore.mode === "activate";
  const restoreSheetEntry =
    pendingRestore
      ? sortedBackups.find((entry) => entry.backup_id === pendingRestore.backupId) ?? null
      : null;
  const restoreSheetTarget = restoreSheetEntry
    ? resolveBackupTarget(restoreSheetEntry.tool, restoreSheetEntry.profile)
    : null;
  const restoreSheetLabel =
    restoreSheetEntry && restoreSheetTarget
      ? toolProfileDisplayLabel(settings, snapshot, restoreSheetTarget.tool, restoreSheetTarget.profile)
      : null;
  const restoreSheetDisplay =
    restoreSheetTarget && restoreSheetLabel
      ? `${titleCase(restoreSheetTarget.tool)} / ${restoreSheetLabel}`
      : null;
  const restoreSheetMode = pendingRestore?.mode ?? null;

  return (
    <SectionCard title="Backups" kicker="Restore points">
      <DesktopStatusStrip
        ariaLabel="Backup highlights"
        items={[
          {
            label: "Restore points",
            value: `${sortedBackups.length} local backup${sortedBackups.length === 1 ? "" : "s"}`,
            note: "Browse and inspect restore points without leaving the main recovery flow.",
          },
          {
            label: "Restore",
            value: "Files first",
            note: "Restore saved files first, then reactivate explicitly only when you want that profile live again.",
          },
          {
            label: "Safety",
            value: "Optional re-activate",
            pills: ["Restore", "Copy ID", "Review target"],
          },
        ]}
      />
      <SplitView
        className="backups-layout"
        primaryClassName="backups-list-pane"
        secondaryClassName="backups-detail-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card backups-list-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Restore points</p>
                  <h3>Local backups</h3>
                </div>
                <p className="inline-note">
                  {sortedBackups.length
                    ? `${sortedBackups.length} restore point${sortedBackups.length === 1 ? "" : "s"} available locally.`
                    : "No saved restore points are available yet."}
                </p>
              </div>
              <div className="backups-list-columns" aria-hidden="true">
                <span>Created</span>
                <span>Tool</span>
                <span>Profile</span>
              </div>
              <div className="stack-list backups-table-rows">
              {sortedBackups.map((entry) => {
                const target = resolveBackupTarget(entry.tool, entry.profile);
                const profileLabel = toolProfileDisplayLabel(
                  settings,
                  snapshot,
                  target.tool,
                  target.profile,
                );
                const targetDisplay = `${titleCase(target.tool)} / ${profileLabel}`;

                return (
                  <button
                    key={entry.backup_id}
                    type="button"
                    className={`list-row backup-list-row ${
                      selectedBackupId === entry.backup_id ? "backup-list-row-selected" : ""
                    }`}
                    aria-label={`Inspect backup for ${targetDisplay}`}
                    aria-pressed={selectedBackupId === entry.backup_id}
                    onClick={() => {
                      setSelectedBackupId(entry.backup_id);
                      setPendingRestore(null);
                    }}
                  >
                    <div className="backup-list-created">
                      <strong>{formatBackupListTimestamp(entry.created_at ?? entry.backup_id)}</strong>
                      <p className="inline-note">
                        {formatBackupTimestamp(entry.created_at ?? entry.backup_id)}
                      </p>
                    </div>
                    <div className="backup-list-main">
                      <strong>{titleCase(target.tool)}</strong>
                      <p className="inline-note">Saved profile snapshot</p>
                    </div>
                    <div className="backup-list-meta">
                      <strong>{profileLabel}</strong>
                      <span>{targetDisplay}</span>
                    </div>
                  </button>
                );
              })}
              {!backups.data?.length ? (
                <article className="diagnostic-card">
                  <h3>{backups.isLoading ? "Loading backups…" : "No backups found."}</h3>
                  <p className="inline-note">
                    {backups.isLoading
                      ? "Loading local restore points."
                      : "AI Switch creates backups before profile switches, renames, and removals. They will appear here automatically."}
                  </p>
                </article>
              ) : null}
              </div>
            </article>
            </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
            {selectedBackup && selectedTarget && selectedProfileLabel ? (
              <article className="diagnostic-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Backup</p>
                    <h3>{selectedProfileLabel}</h3>
                  </div>
                  <p className="inline-note">
                    Restore saved files first, then reactivate explicitly only when you want that profile live again.
                  </p>
                </div>
                <div className="backups-detail-summary">
                  <div>
                    <span className="overview-current-set-cell-label">Created</span>
                    <strong>{formatBackupTimestamp(selectedBackup.created_at ?? selectedBackup.backup_id)}</strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Target</span>
                    <strong>{selectedTargetDisplay}</strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Recovery</span>
                    <strong>Files first</strong>
                  </div>
                </div>
                <KeyValueGrid
                  rows={[
                    { label: "Tool", value: titleCase(selectedTarget.tool) },
                    { label: "Profile", value: selectedProfileLabel },
                    { label: "Backup ID", value: selectedBackup.backup_id },
                  ]}
                />
                <div className="backups-detail-block">
                  <div>
                    <p className="card-kicker">Saved state</p>
                    <p className="inline-note">
                      {titleCase(selectedTarget.tool)} profile <strong>{selectedProfileLabel}</strong> and its saved config snapshot.
                    </p>
                  </div>
                  <div>
                    <p className="card-kicker">Restore behavior</p>
                    <p className="inline-note">
                      Affects {selectedTargetDisplay}. Restore files only unless you explicitly re-activate this profile.
                    </p>
                  </div>
                </div>
                <div className="button-row">
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => onOpenProfiles(selectedTarget.tool, selectedTarget.profile)}
                  >
                    Open profile details
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void copyBackupId(selectedBackup.backup_id)}
                  >
                    Copy backup ID
                  </button>
                </div>
                <div className="button-row">
                  {!selectedPendingFilesRestore && !selectedPendingRestoreAndActivate ? (
                    <>
                      <button
                        className="ghost-button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          setPendingRestore({
                            backupId: selectedBackup.backup_id,
                            mode: "files",
                          })
                        }
                      >
                        Restore files only
                      </button>
                      <button
                        className="primary-button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          setPendingRestore({
                            backupId: selectedBackup.backup_id,
                            mode: "activate",
                          })
                        }
                      >
                        Restore and activate
                      </button>
                    </>
                  ) : null}
                </div>
                {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
              </article>
            ) : (
              <article className="diagnostic-card">
                <h3>No backup selected</h3>
                <p className="inline-note">
                  Choose a restore point from the list to inspect its scope and restore actions.
                </p>
              </article>
            )}
          </div>
        }
      />
      {restoreSheetEntry && restoreSheetTarget && restoreSheetLabel && restoreSheetDisplay ? (
        <div className="quick-switch-overlay" role="presentation" onClick={() => setPendingRestore(null)}>
          <section
            className="quick-switch-palette profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Restore Backup"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Restore point</p>
                <h3>Restore backup?</h3>
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
                { label: "Target", value: restoreSheetDisplay },
                {
                  label: "Created",
                  value: formatBackupTimestamp(restoreSheetEntry.created_at ?? restoreSheetEntry.backup_id),
                },
                { label: "Backup ID", value: restoreSheetEntry.backup_id },
              ]}
            />
            {restoreSheetMode === "files" ? (
              <div className="stack-list">
                <p className="inline-note">
                  This will restore profile files for {restoreSheetDisplay}.
                </p>
                <p className="inline-note">
                  It will not change the active account until you activate it later.
                </p>
              </div>
            ) : (
              <div className="stack-list">
                <p className="inline-note">
                  This will restore profile files for {restoreSheetDisplay}.
                </p>
                <p className="inline-note">
                  It will also switch the live profile again after the restore completes.
                </p>
              </div>
            )}
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">Action</p>
                <strong>{restoreSheetMode === "files" ? "Restore files only" : "Restore and activate"}</strong>
                <p>
                  {restoreSheetMode === "files"
                    ? "Restore saved files only."
                    : "Restore saved files, then reactivate the profile."}
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
                  onClick={() => confirmRestore(restoreSheetEntry, restoreSheetMode === "files" ? "files" : "activate")}
                >
                  {restoreSheetMode === "files" ? "Restore" : "Restore and activate"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </SectionCard>
  );
}

function resolveBackupTarget(tool: string, profile: string) {
  if (profile.includes("/")) {
    const [resolvedTool, resolvedProfile] = profile.split("/", 2);
    if (resolvedTool && resolvedProfile) {
      return { tool: resolvedTool, profile: resolvedProfile };
    }
  }
  return { tool, profile };
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

function formatBackupListTimestamp(value: string) {
  const isoDate = Date.parse(value);
  if (!Number.isNaN(isoDate)) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
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
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
