import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { listBackups } from "../../../lib/client";
import { useDesktopActions } from "../../shared/useDesktopActions";

export function BackupsPanel() {
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups });
  const { restoreBackupMutation, useProfileMutation } = useDesktopActions();
  const [copyMessage, setCopyMessage] = useState("");

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
        {backups.data?.map((entry) => (
          <article key={entry.backup_id} className="list-row">
            <div>
              <strong>{entry.backup_id}</strong>
              <p className="inline-note">Created: {formatBackupTimestamp(entry.backup_id)}</p>
              <p>
                {entry.tool} / {entry.profile}
              </p>
              <p className="inline-note">Restore files only unless you explicitly re-activate this profile.</p>
            </div>
            <div className="button-row">
              <button
                className="ghost-button"
                type="button"
                onClick={() => void copyBackupId(entry.backup_id)}
              >
                Copy backup ID
              </button>
              <button
                className="ghost-button"
                onClick={() => restoreBackupMutation.mutate(entry.backup_id)}
              >
                Restore files only
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  restoreBackupMutation.mutate(entry.backup_id, {
                    onSuccess: () => {
                      const [tool, profile] = entry.profile.includes("/")
                        ? entry.profile.split("/", 2)
                        : [entry.tool, entry.profile];
                      if (!tool || !profile) return;
                      useProfileMutation.mutate({
                        tool,
                        profile,
                        stateMode: tool === "gemini" ? null : "isolated",
                      });
                    },
                  });
                }}
              >
                Restore and activate
              </button>
            </div>
          </article>
        ))}
        {!backups.data?.length ? (
          <p className="inline-note">{backups.isLoading ? "Loading backups…" : "No backups found."}</p>
        ) : null}
        {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
      </div>
    </SectionCard>
  );
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
