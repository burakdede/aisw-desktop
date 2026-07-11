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

  return (
    <SectionCard title="Backups" kicker="Recovery">
      <DesktopStatusStrip
        ariaLabel="Backup highlights"
        items={[
          {
            label: "Library",
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
      <article className="diagnostic-card desktop-pane-intro">
        <h3>Restore points</h3>
        <p className="inline-note">
          Restore replays the saved files only. It does not activate that profile again until you run
          a matching <code>use</code> action or choose restore and activate here.
        </p>
        <p className="inline-note">
          {sortedBackups.length ? `${sortedBackups.length} saved backup${sortedBackups.length === 1 ? "" : "s"} available locally.` : "No saved backups are available yet."}
        </p>
      </article>
      <SplitView
        className="backups-layout"
        primaryClassName="backups-list-pane"
        secondaryClassName="backups-detail-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <div className="desktop-pane-section desktop-list-surface">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Timeline</p>
                  <h3>Local backups</h3>
                </div>
                <p className="inline-note">
                  Select a restore point to inspect its scope and recovery options.
                </p>
              </div>
            </div>
            <div className="stack-list desktop-list-stack">
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
                  <article
                    key={entry.backup_id}
                    className={`list-row backup-list-row ${
                      selectedBackupId === entry.backup_id ? "backup-list-row-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedBackupId(entry.backup_id);
                      setPendingRestore(null);
                    }}
                  >
                    <div className="backup-list-main">
                      <strong>{profileLabel}</strong>
                      <p className="inline-note">
                        {formatBackupTimestamp(entry.created_at ?? entry.backup_id)}
                      </p>
                    </div>
                    <div className="backup-list-meta">
                      <span>{titleCase(target.tool)}</span>
                      <span>{targetDisplay}</span>
                    </div>
                  </article>
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
                    Restore files only by default, then reactivate explicitly only when you want to switch the live profile again.
                  </p>
                </div>
                <KeyValueGrid
                  rows={[
                    { label: "Tool", value: titleCase(selectedTarget.tool) },
                    { label: "Profile", value: selectedProfileLabel },
                    {
                      label: "Created",
                      value: formatBackupTimestamp(selectedBackup.created_at ?? selectedBackup.backup_id),
                    },
                    { label: "Backup ID", value: selectedBackup.backup_id },
                  ]}
                />
                <p className="inline-note">
                  Affects {selectedTargetDisplay}. Restore files only unless you explicitly
                  re-activate this profile.
                </p>
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
                  {selectedPendingFilesRestore ? (
                    <>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => confirmRestore(selectedBackup, "files")}
                      >
                        Confirm restore files
                      </button>
                      <button className="ghost-button" type="button" onClick={() => setPendingRestore(null)}>
                        Cancel
                      </button>
                    </>
                  ) : null}
                  {selectedPendingRestoreAndActivate ? (
                    <>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => confirmRestore(selectedBackup, "activate")}
                      >
                        Confirm restore and activate
                      </button>
                      <button className="ghost-button" type="button" onClick={() => setPendingRestore(null)}>
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
                {selectedPendingFilesRestore ? (
                  <p className="inline-note">
                    Confirm before restoring {selectedTargetDisplay}. This replays the saved files only.
                  </p>
                ) : null}
                {selectedPendingRestoreAndActivate ? (
                  <p className="inline-note">
                    Confirm before restoring and activating {selectedTargetDisplay}. This replays the backup and switches the live profile again.
                  </p>
                ) : null}
                {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
              </article>
            ) : (
              <article className="diagnostic-card">
                <h3>No backup selected</h3>
                <p className="inline-note">
                  Choose a backup from the list to inspect its scope and restore actions.
                </p>
              </article>
            )}
          </div>
        }
      />
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
