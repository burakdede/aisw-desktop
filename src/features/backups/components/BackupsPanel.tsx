import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import { listBackups } from "../../../lib/client";
import { useDesktopActions } from "../../shared/useDesktopActions";

export function BackupsPanel() {
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups });
  const { restoreBackupMutation, useProfileMutation } = useDesktopActions();

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
              <p>
                {entry.tool} / {entry.profile}
              </p>
              <p className="inline-note">Restore files only unless you explicitly re-activate this profile.</p>
            </div>
            <div className="button-row">
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
      </div>
    </SectionCard>
  );
}
