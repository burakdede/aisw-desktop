import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppFrame } from "./components/AppFrame";
import { SectionCard } from "./components/SectionCard";
import { recordCommandResult } from "./features/shared/lastCommandResult";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { ContextsPanel } from "./features/contexts/components/ContextsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import { OverviewPanel } from "./features/overview/components/OverviewPanel";
import { ProfilesPanel } from "./features/profiles/components/ProfilesPanel";
import { invalidatePostMutationQueries } from "./features/shared/postMutationRefresh";
import {
  SettingsPanel,
  type SettingsSection,
} from "./features/settings/components/SettingsPanel";
import { useDesktop } from "./features/shared/useDesktop";
import { WorkspacesPanel } from "./features/workspaces/components/WorkspacesPanel";
import { notifyDesktop } from "./lib/notifications";
import { activeSetLabel } from "./lib/profile-display";
import { DesktopCommandError } from "./lib/tauri";
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

const DIAGNOSTICS_QUERY_KEYS = [
  ["doctor"],
  ["verify"],
  ["repair", "dry-run"],
  ["snapshot"],
  ["bootstrap"],
] as const;

type ProfilesRouteState = {
  tool?: string;
  expandedProfile?: string | null;
};

type SettingsRouteState = {
  section?: SettingsSection;
};

export function App() {
  const queryClient = useQueryClient();
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]["id"]>("overview");
  const [profilesRouteState, setProfilesRouteState] = useState<ProfilesRouteState>({});
  const [settingsRouteState, setSettingsRouteState] = useState<SettingsRouteState>({});
  const { bootstrap, snapshot, init } = useDesktop();

  function openSettings(section?: SettingsSection) {
    setSettingsRouteState({ section });
    setActiveNav("settings");
  }

  function selectNav(id: string) {
    if (id === "profiles") {
      setProfilesRouteState({});
    }
    if (id === "settings") {
      setSettingsRouteState({});
    }
    setActiveNav(id as (typeof NAV)[number]["id"]);
  }

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

    void listenDesktopEvent("tray-run-diagnostics", () => {
      if (!active) return;
      setActiveNav("diagnostics");
      for (const queryKey of DIAGNOSTICS_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
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
            kind: "kind" in payload && typeof payload.kind === "string" ? payload.kind : undefined,
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
            kind: "kind" in payload && typeof payload.kind === "string" ? payload.kind : undefined,
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
      void invalidatePostMutationQueries(queryClient);
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    return () => {
      active = false;
      disposers.forEach((dispose) => dispose());
    };
  }, [queryClient]);

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
    const bootstrapError = describeBootstrapError(bootstrap.error);
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="eyebrow">AISW Desktop</p>
          <h1>Desktop bootstrap failed.</h1>
          <p className="lede">Check the configured `aisw` runtime, local permissions, and JSON contract compatibility.</p>
          <p className="inline-note">{bootstrapError.message}</p>
          {bootstrapError.remediation ? (
            <p className="inline-note">{bootstrapError.remediation}</p>
          ) : null}
        </section>
      </main>
    );
  }

  const { runtime_status: runtimeStatus, settings } = bootstrap.data;
  const resolvedSnapshot = snapshot.data ?? bootstrap.data.snapshot;
  const toolCapabilities = runtimeStatus.capabilities?.tools ?? {};
  const currentActiveSet = resolvedSnapshot ? activeSetLabel(settings, resolvedSnapshot) : null;
  const runtimeBlocked = !runtimeStatus.compatible;
  const activeSection = runtimeBlocked ? "settings" : activeNav;
  const navItems = NAV.map(({ id, label }) => ({
    id,
    label,
    disabled: runtimeBlocked && id !== "settings",
  }));

  return (
    <AppFrame
      title="Local-first switching"
      subtitle="See agent identity state, switch safely, and recover from auth drift without touching hidden files."
      nav={navItems}
      activeNav={activeSection}
      onSelectNav={selectNav}
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
            <p className="inline-note">
              Fix the selected `aisw` runtime in Settings before profile switching, diagnostics,
              backups, or workspace actions are available again.
            </p>
          </div>
        </SectionCard>
      ) : null}

      {runtimeBlocked ? (
        <SettingsPanel settings={settings} runtimeStatus={runtimeStatus} />
      ) : resolvedSnapshot ? (
        <>
          <SetupPanel
            bootstrap={bootstrap.data}
            snapshot={resolvedSnapshot}
            initReport={init.data}
            onOpenProfiles={(tool) => {
              setProfilesRouteState({ tool, expandedProfile: null });
              setActiveNav("profiles");
            }}
            onOpenSettings={openSettings}
          />
          {activeSection === "overview" ? (
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
          {activeSection === "profiles" ? (
            <ProfilesPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              initialTool={profilesRouteState.tool}
              initialExpandedProfile={profilesRouteState.expandedProfile}
            />
          ) : null}
          {activeSection === "contexts" ? (
            <ContextsPanel snapshot={resolvedSnapshot} settings={settings} />
          ) : null}
          {activeSection === "workspaces" ? (
            <WorkspacesPanel snapshot={resolvedSnapshot} settings={settings} />
          ) : null}
          {activeSection === "diagnostics" ? (
            <DiagnosticsPanel
              settings={settings}
              snapshot={resolvedSnapshot}
              onOpenSettings={openSettings}
              onOpenProfiles={(tool, expandedProfile) => {
                setProfilesRouteState({ tool, expandedProfile });
                setActiveNav("profiles");
              }}
            />
          ) : null}
          {activeSection === "backups" ? (
            <BackupsPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              onOpenProfiles={(tool, expandedProfile) => {
                setProfilesRouteState({ tool, expandedProfile });
                setActiveNav("profiles");
              }}
            />
          ) : null}
          {activeSection === "settings" ? (
            <SettingsPanel
              settings={settings}
              runtimeStatus={runtimeStatus}
              initialSection={settingsRouteState.section}
            />
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

function describeBootstrapError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return {
      message: error.message,
      remediation: error.remediation,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      remediation: undefined,
    };
  }

  return {
    message: "AISW Desktop could not load its initial local state.",
    remediation: undefined,
  };
}
