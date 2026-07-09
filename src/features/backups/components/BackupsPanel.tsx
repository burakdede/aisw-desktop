import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import { listBackups } from "../../../lib/client";

export function BackupsPanel() {
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups });

  return (
    <SectionCard title="Backups" kicker="Recovery">
      <div className="stack-list">
        {backups.data?.map((entry) => (
          <article key={entry.backup_id} className="list-row">
            <div>
              <strong>{entry.backup_id}</strong>
              <p>
                {entry.tool} / {entry.profile}
              </p>
            </div>
            <span className="pill pill-soft">Restore via command surface next</span>
          </article>
        ))}
        {!backups.data?.length ? (
          <p className="inline-note">{backups.isLoading ? "Loading backups…" : "No backups found."}</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
