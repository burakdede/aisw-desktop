import { useState } from "react";
import { AppFrame } from "./components/AppFrame";
import { SectionCard } from "./components/SectionCard";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { ContextsPanel } from "./features/contexts/components/ContextsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import { OverviewPanel } from "./features/overview/components/OverviewPanel";
import { ProfilesPanel } from "./features/profiles/components/ProfilesPanel";
import { SettingsPanel } from "./features/settings/components/SettingsPanel";
import { useDesktop } from "./features/shared/useDesktop";
import { WorkspacesPanel } from "./features/workspaces/components/WorkspacesPanel";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "profiles", label: "Profiles" },
  { id: "contexts", label: "Contexts" },
  { id: "workspaces", label: "Workspaces" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "backups", label: "Backups" },
  { id: "settings", label: "Settings" },
] as const;

export function App() {
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]["id"]>("overview");
  const { bootstrap, snapshot, init } = useDesktop();

  if (bootstrap.isLoading) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="eyebrow">AISW Desktop</p>
          <h1>Loading local control plane…</h1>
        </section>
      </main>
    );
  }

  if (bootstrap.isError || !bootstrap.data) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="eyebrow">AISW Desktop</p>
          <h1>Desktop bootstrap failed.</h1>
          <p className="lede">Check the configured `aisw` runtime, local permissions, and JSON contract compatibility.</p>
        </section>
      </main>
    );
  }

  const { runtime_status: runtimeStatus, settings } = bootstrap.data;
  const resolvedSnapshot = snapshot.data ?? bootstrap.data.snapshot;
  const toolCapabilities = runtimeStatus.capabilities?.tools ?? {};

  return (
    <AppFrame
      title="Local-first switching"
      subtitle="See agent identity state, switch safely, and recover from auth drift without touching hidden files."
      nav={NAV.map(({ id, label }) => ({ id, label }))}
      activeNav={activeNav}
      onSelectNav={(id) => setActiveNav(id as (typeof NAV)[number]["id"])}
      statusBadge={
        <div>
          <strong>{runtimeStatus.compatible ? "Runtime ready" : "Runtime blocked"}</strong>
          <p>{runtimeStatus.resolved_path ?? "No aisw runtime resolved"}</p>
        </div>
      }
    >
      {!runtimeStatus.compatible ? (
        <SectionCard title="Runtime compatibility" kicker="Onboarding blocker">
          <div className="stack-list">
            {runtimeStatus.issues.map((issue) => (
              <p key={issue} className="inline-note">
                {issue}
              </p>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {resolvedSnapshot ? (
        <>
          <SetupPanel bootstrap={bootstrap.data} snapshot={resolvedSnapshot} initReport={init.data} />
          {activeNav === "overview" ? (
            <OverviewPanel snapshot={resolvedSnapshot} toolCapabilities={toolCapabilities} />
          ) : null}
          {activeNav === "profiles" ? (
            <ProfilesPanel snapshot={resolvedSnapshot} toolCapabilities={toolCapabilities} />
          ) : null}
          {activeNav === "contexts" ? (
            <ContextsPanel snapshot={resolvedSnapshot} settings={settings} />
          ) : null}
          {activeNav === "workspaces" ? <WorkspacesPanel snapshot={resolvedSnapshot} /> : null}
          {activeNav === "diagnostics" ? <DiagnosticsPanel /> : null}
          {activeNav === "backups" ? <BackupsPanel /> : null}
          {activeNav === "settings" ? <SettingsPanel settings={settings} /> : null}
        </>
      ) : (
        <SectionCard title="Waiting for snapshot" kicker="Bootstrap">
          <p className="inline-note">The runtime is compatible, but no state snapshot is available yet.</p>
        </SectionCard>
      )}
    </AppFrame>
  );
}
