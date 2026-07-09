import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import { runDoctor, runRepair, runVerify } from "../../../lib/client";

export function DiagnosticsPanel() {
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor });
  const verify = useQuery({ queryKey: ["verify"], queryFn: runVerify });
  const repair = useQuery({
    queryKey: ["repair", "dry-run"],
    queryFn: () => runRepair({ apply: false, fixes: [] }),
  });

  return (
    <SectionCard title="Diagnostics" kicker="Doctor · Verify · Repair">
      <div className="panel-grid panel-grid-3">
        <DiagnosticBlock title="Doctor" payload={doctor.data} isLoading={doctor.isLoading} />
        <DiagnosticBlock title="Verify" payload={verify.data} isLoading={verify.isLoading} />
        <DiagnosticBlock title="Repair preview" payload={repair.data} isLoading={repair.isLoading} />
      </div>
    </SectionCard>
  );
}

function DiagnosticBlock({
  title,
  payload,
  isLoading,
}: {
  title: string;
  payload: Record<string, unknown> | undefined;
  isLoading: boolean;
}) {
  return (
    <article className="diagnostic-card">
      <h3>{title}</h3>
      <pre>{isLoading ? "Loading…" : JSON.stringify(payload, null, 2)}</pre>
    </article>
  );
}
