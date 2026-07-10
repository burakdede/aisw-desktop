import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { listBackups } from "../../../lib/client";
import { toolProfileDisplayLabel } from "../../../lib/profile-display";
import { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { useDesktopActions } from "../../shared/useDesktopActions";

export function BackupsPanel({
  snapshot,
  settings,
  onOpenProfiles,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  onOpenProfiles: (tool: string, expandedProfile?: string | null) => void;
}) {
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups });
  const { restoreBackupMutation, useProfileMutation, mutationLock } = useDesktopActions();
  const [copyMessage, setCopyMessage] = useState("");
  const [pendingRestore, setPendingRestore] = useState<{
    backupId: string;
    mode: "files" | "activate";
  } | null>(null);
  const sortedBackups = useMemo(
    () =>
      [...(backups.data ?? [])].sort((left, right) => right.backup_id.localeCompare(left.backup_id)),
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
    restoreBackupMutation.mutate(entry.backup_id, {
      onSuccess: () => {
        setPendingRestore(null);
        if (mode === "activate") {
          useProfileMutation.mutate({
            tool: target.tool,
            profile: target.profile,
            stateMode: target.tool === "gemini" ? null : "isolated",
          });
        }
      },
    });
  }

  return (
    <SectionCard title="Backups" kicker="Recovery">
      <p className="inline-note">
        Restore replays the saved files only. It does not activate that profile again until you run
        a matching <code>use</code> action or choose restore and activate here.
      </p>
      <div className="stack-list">
        {sortedBackups.map((entry) => {
          const target = resolveBackupTarget(entry.tool, entry.profile);
          const profileLabel = toolProfileDisplayLabel(
            settings,
            snapshot,
            target.tool,
            target.profile,
          );
          const isPendingFilesRestore =
            pendingRestore?.backupId === entry.backup_id && pendingRestore.mode === "files";
          const isPendingRestoreAndActivate =
            pendingRestore?.backupId === entry.backup_id && pendingRestore.mode === "activate";

          return (
          <article key={entry.backup_id} className="list-row">
            <div>
              <strong>{profileLabel}</strong>
              <p className="inline-note">Created: {formatBackupTimestamp(entry.backup_id)}</p>
              <p>
                {titleCase(target.tool)} backup · {entry.backup_id}
              </p>
              <p className="inline-note">
                Affects {target.tool} / {target.profile}. Restore files only unless you explicitly
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
                Confirm before restoring {target.tool} / {target.profile}. This replays the saved files only.
              </p>
            ) : null}
            {isPendingRestoreAndActivate ? (
              <p className="inline-note">
                Confirm before restoring and activating {target.tool} / {target.profile}. This replays the backup and switches the live profile again.
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

function formatBackupTimestamp(backupId: string) {
  const match = backupId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
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
