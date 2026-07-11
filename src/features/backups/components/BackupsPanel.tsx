import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
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

  return (
    <SectionCard title="Backups" kicker="Recovery">
      <article className="desktop-pane-hero backups-hero">
        <div className="desktop-pane-hero-copy">
          <p className="card-kicker">Recovery</p>
          <h3>Restore profiles from one consistent backup flow</h3>
          <p className="inline-note">
            Backup browsing, copy, restore, and restore-and-activate all stay in the same interaction pattern used across the rest of the desktop app.
          </p>
        </div>
        <div className="desktop-pane-hero-pills" aria-label="Backup highlights">
          <span className="status-pill">
            {sortedBackups.length} local backup{sortedBackups.length === 1 ? "" : "s"}
          </span>
          <span className="status-pill">Files-first restore</span>
          <span className="status-pill">Optional re-activate</span>
        </div>
      </article>
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
      <div className="stack-list desktop-pane-stack">
        {sortedBackups.map((entry) => {
          const target = resolveBackupTarget(entry.tool, entry.profile);
          const profileLabel = toolProfileDisplayLabel(
            settings,
            snapshot,
            target.tool,
            target.profile,
          );
          const targetDisplay = `${titleCase(target.tool)} / ${profileLabel}`;
          const isPendingFilesRestore =
            pendingRestore?.backupId === entry.backup_id && pendingRestore.mode === "files";
          const isPendingRestoreAndActivate =
            pendingRestore?.backupId === entry.backup_id && pendingRestore.mode === "activate";

          return (
          <article key={entry.backup_id} className="list-row">
            <div>
              <strong>{profileLabel}</strong>
              <p className="inline-note">Created: {formatBackupTimestamp(entry.created_at ?? entry.backup_id)}</p>
              <p>
                {titleCase(target.tool)} backup · {entry.backup_id}
              </p>
              <p className="inline-note">
                Affects {targetDisplay}. Restore files only unless you explicitly
                re-activate this profile.
              </p>
            </div>
            <div className="button-row">
              <button
                className="ghost-button"
                type="button"
                disabled={mutationLock.isBusy}
                onClick={() => onOpenProfiles(target.tool, target.profile)}
              >
                Open profile details
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => void copyBackupId(entry.backup_id)}
              >
                Copy backup ID
              </button>
              <button
                className="ghost-button"
                disabled={mutationLock.isBusy}
                onClick={() =>
                  setPendingRestore({
                    backupId: entry.backup_id,
                    mode: "files",
                  })
                }
              >
                Restore files only
              </button>
              {isPendingFilesRestore ? (
                <>
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => confirmRestore(entry, "files")}
                  >
                    Confirm restore files
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setPendingRestore(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : isPendingRestoreAndActivate ? (
                <>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => confirmRestore(entry, "activate")}
                  >
                    Confirm restore and activate
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setPendingRestore(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="primary-button"
                  disabled={mutationLock.isBusy}
                  onClick={() =>
                    setPendingRestore({
                      backupId: entry.backup_id,
                      mode: "activate",
                    })
                  }
                >
                  Restore and activate
                </button>
              )}
            </div>
            {isPendingFilesRestore ? (
              <p className="inline-note">
                Confirm before restoring {targetDisplay}. This replays the saved files only.
              </p>
            ) : null}
            {isPendingRestoreAndActivate ? (
              <p className="inline-note">
                Confirm before restoring and activating {targetDisplay}. This replays the backup and switches the live profile again.
              </p>
            ) : null}
          </article>
        )})}
        {!backups.data?.length ? (
          <p className="inline-note">{backups.isLoading ? "Loading backups…" : "No backups found."}</p>
        ) : null}
        {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
      </div>
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
