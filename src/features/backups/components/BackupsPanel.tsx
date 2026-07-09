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
                onClick={() => restoreBackupMutation.mutate(entry.backup_id)}
              >
                Restore files only
              </button>
              <button
                className="primary-button"
                disabled={mutationLock.isBusy}
                onClick={() => {
                  restoreBackupMutation.mutate(entry.backup_id, {
                    onSuccess: () => {
                      useProfileMutation.mutate({
                        tool: target.tool,
                        profile: target.profile,
                        stateMode: target.tool === "gemini" ? null : "isolated",
                      });
                    },
                  });
                }}
              >
                Restore and activate
              </button>
            </div>
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
