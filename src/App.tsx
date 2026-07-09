import { useEffect, useState } from "react";
import { AppFrame } from "./components/AppFrame";
import { SectionCard } from "./components/SectionCard";
import { recordCommandResult } from "./features/shared/lastCommandResult";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { ContextsPanel } from "./features/contexts/components/ContextsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import { OverviewPanel } from "./features/overview/components/OverviewPanel";
import { ProfilesPanel } from "./features/profiles/components/ProfilesPanel";
import { SettingsPanel } from "./features/settings/components/SettingsPanel";
import { useDesktop } from "./features/shared/useDesktop";
import { WorkspacesPanel } from "./features/workspaces/components/WorkspacesPanel";
import { notifyDesktop } from "./lib/notifications";
import { activeSetLabel } from "./lib/profile-display";
import { listenDesktopEvent, type TrayCommandResultEvent } from "./lib/tauri";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "profiles", label: "Profiles" },
  { id: "contexts", label: "Contexts" },
  { id: "workspaces", label: "Workspaces" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "backups", label: "Backups" },
  { id: "settings", label: "Settings" },
] as const;

type ProfilesRouteState = {
  tool?: string;
  expandedProfile?: string | null;
};

export function App() {
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]["id"]>("overview");
  const [profilesRouteState, setProfilesRouteState] = useState<ProfilesRouteState>({});
  const { bootstrap, snapshot, init } = useDesktop();

  useEffect(() => {
    let active = true;
    const disposers: Array<() => void> = [];

    void listenDesktopEvent("tray-open-diagnostics", () => {
      if (!active) return;
      setActiveNav("diagnostics");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent<TrayCommandResultEvent>("tray-command-result", (payload) => {
      if (!active) return;

      if (payload.scope === "tool") {
        recordCommandResult(
          { type: "tool", tool: payload.tool },
          {
            label: payload.label,
            status: payload.status,
            message: payload.message,
            remediation: payload.remediation,
          },
        );
      } else {
        recordCommandResult(
          { type: "global", id: payload.id },
          {
            label: payload.label,
            status: payload.status,
            message: payload.message,
            remediation: payload.remediation,
          },
        );
      }

      void notifyDesktop({
        title: payload.label,
        body:
          payload.status === "success"
            ? payload.message
            : [payload.message, payload.remediation].filter(Boolean).join(" "),
      });
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    return () => {
      active = false;
      disposers.forEach((dispose) => dispose());
    };
  }, []);

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
  const currentActiveSet = resolvedSnapshot ? activeSetLabel(settings, resolvedSnapshot) : null;

  return (
    <AppFrame
      title="Local-first switching"
      subtitle="See agent identity state, switch safely, and recover from auth drift without touching hidden files."
      nav={NAV.map(({ id, label }) => ({ id, label }))}
      activeNav={activeNav}
      onSelectNav={(id) => setActiveNav(id as (typeof NAV)[number]["id"])}
      statusBadge={
        <div>
          <strong>{currentActiveSet ? `Active set: ${currentActiveSet}` : "No shared active set"}</strong>
          <p>{runtimeStatus.compatible ? "Runtime ready" : "Runtime blocked"}</p>
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
          <SetupPanel
            bootstrap={bootstrap.data}
            snapshot={resolvedSnapshot}
            initReport={init.data}
            onOpenProfiles={(tool) => {
              setProfilesRouteState({ tool, expandedProfile: null });
              setActiveNav("profiles");
            }}
          />
          {activeNav === "overview" ? (
            <OverviewPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              onOpenProfiles={(tool, expandedProfile) => {
                setProfilesRouteState({ tool, expandedProfile });
                setActiveNav("profiles");
              }}
            />
          ) : null}
          {activeNav === "profiles" ? (
            <ProfilesPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              initialTool={profilesRouteState.tool}
              initialExpandedProfile={profilesRouteState.expandedProfile}
            />
          ) : null}
          {activeNav === "contexts" ? (
            <ContextsPanel snapshot={resolvedSnapshot} settings={settings} />
          ) : null}
          {activeNav === "workspaces" ? (
            <WorkspacesPanel snapshot={resolvedSnapshot} settings={settings} />
          ) : null}
          {activeNav === "diagnostics" ? <DiagnosticsPanel settings={settings} /> : null}
          {activeNav === "backups" ? <BackupsPanel /> : null}
          {activeNav === "settings" ? (
            <SettingsPanel settings={settings} runtimeStatus={runtimeStatus} />
          ) : null}
        </>
      ) : (
        <SectionCard title="Waiting for snapshot" kicker="Bootstrap">
          <p className="inline-note">The runtime is compatible, but no state snapshot is available yet.</p>
        </SectionCard>
      )}
    </AppFrame>
  );
}
