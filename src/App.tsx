import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppFrame } from "./components/AppFrame";
import { SectionCard } from "./components/SectionCard";
import { recordCommandResult } from "./features/shared/lastCommandResult";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import { OverviewPanel } from "./features/overview/components/OverviewPanel";
import { ProfilesPanel } from "./features/profiles/components/ProfilesPanel";
import { ActivityPanel } from "./features/activity/components/ActivityPanel";
import { SetsPanel } from "./features/sets/components/SetsPanel";
import { invalidatePostMutationQueries } from "./features/shared/postMutationRefresh";
import {
  SettingsPanel,
  type SettingsSection,
} from "./features/settings/components/SettingsPanel";
import { useDesktop } from "./features/shared/useDesktop";
import { notifyDesktop } from "./lib/notifications";
import { activeSetLabel } from "./lib/profile-display";
import { DesktopCommandError } from "./lib/tauri";
import { listenDesktopEvent, type TrayCommandResultEvent } from "./lib/tauri";
import type { ProfileImportMode } from "./features/shared/profile-capabilities";

const NAV = [
  { id: "overview", label: "Overview", group: "Main" },
  { id: "profiles", label: "Profiles", group: "Main" },
  { id: "sets", label: "Sets", group: "Main" },
  { id: "diagnostics", label: "Diagnostics", group: "Health" },
  { id: "backups", label: "Backups", group: "Health" },
  { id: "activity", label: "Activity", group: "Health" },
  { id: "settings", label: "Settings", group: "App" },
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
  mode?: ProfileImportMode;
  credentialBackend?: "file" | "system-keyring" | null;
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

  function openContexts() {
    setActiveNav("sets");
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
          <p className="eyebrow">AI Switch</p>
          <h1>Loading your local account control center…</h1>
        </section>
      </main>
    );
  }

  if (bootstrap.isError || !bootstrap.data) {
    const bootstrapError = describeBootstrapError(bootstrap.error);
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="eyebrow">AI Switch</p>
          <h1>AI Switch could not finish startup.</h1>
          <p className="lede">Check the selected runtime, local permissions, and compatibility details before continuing.</p>
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
  const navItems = NAV.map(({ id, label, group }) => ({
    id,
    label,
    group,
    disabled: runtimeBlocked && id !== "settings",
  }));
  const runtimeBlocker = describeRuntimeBlocker(runtimeStatus);

  return (
    <AppFrame
      title={sectionTitle(activeSection)}
      subtitle="Manage Claude Code, Codex CLI, and Gemini CLI identities from a compact local Mac utility."
      nav={navItems}
      activeNav={activeSection}
      onSelectNav={selectNav}
      toolbar={
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={() => setActiveNav("sets")}>
            Quick Switch
          </button>
          <button className="ghost-button" type="button" onClick={() => setActiveNav("diagnostics")}>
            Verify
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setProfilesRouteState({ tool: "claude", expandedProfile: null });
              setActiveNav("profiles");
            }}
          >
            Add Profile
          </button>
        </div>
      }
      statusBadge={
        <div>
          <strong>{currentActiveSet ? `Current set: ${currentActiveSet}` : "No shared set active"}</strong>
          <p>{runtimeStatus.compatible ? "Ready to switch" : "Needs attention"}</p>
          <p>{runtimeStatus.resolved_path ?? "No runtime resolved"}</p>
        </div>
      }
    >
      {!runtimeStatus.compatible ? (
        <SectionCard title="Runtime compatibility" kicker="Onboarding blocker">
          <div className="stack-list">
            <p className="inline-note">
              {runtimeBlocker.summary}
            </p>
            <p className="inline-note">{runtimeBlocker.nextStep}</p>
            {runtimeStatus.issues.length ? (
              <article className="diagnostic-card">
                <h3>Technical details</h3>
                {runtimeStatus.issues.map((issue) => (
                  <p key={issue} className="inline-note">
                    {issue}
                  </p>
                ))}
              </article>
            ) : null}
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
            onOpenProfiles={(tool, options) => {
              setProfilesRouteState({ tool, expandedProfile: null, mode: options?.mode });
              setActiveNav("profiles");
            }}
            onOpenSettings={openSettings}
          />
          {activeSection === "overview" ? (
            <OverviewPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              onOpenContexts={openContexts}
              onOpenProfiles={(tool, expandedProfile, options) => {
                setProfilesRouteState({ tool, expandedProfile, mode: options?.mode });
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
              initialMode={profilesRouteState.mode}
              initialCredentialBackend={profilesRouteState.credentialBackend}
            />
          ) : null}
          {activeSection === "sets" ? (
            <SetsPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              onOpenContexts={openContexts}
            />
          ) : null}
          {activeSection === "diagnostics" ? (
            <DiagnosticsPanel
              settings={settings}
              snapshot={resolvedSnapshot}
              toolCapabilities={toolCapabilities}
              onOpenSettings={openSettings}
              onOpenContexts={openContexts}
              onOpenProfiles={(tool, expandedProfile) => {
                setProfilesRouteState({ tool, expandedProfile });
                setActiveNav("profiles");
              }}
              onOpenProfileSetup={(options) => {
                setProfilesRouteState({
                  tool: options?.tool,
                  expandedProfile: null,
                  mode: options?.mode,
                  credentialBackend: options?.credentialBackend ?? null,
                });
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
          {activeSection === "activity" ? <ActivityPanel /> : null}
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
    message: "AI Switch could not load its initial local state.",
    remediation: undefined,
  };
}

function describeRuntimeBlocker(runtimeStatus: {
  resolved_path?: string | null;
  version?: unknown;
  capabilities?: unknown;
  issues: string[];
}) {
  const hasResolvedRuntime = Boolean(runtimeStatus.resolved_path);
  const missingDesktopContract =
    runtimeStatus.version == null ||
    runtimeStatus.capabilities == null ||
    runtimeStatus.issues.some(
      (issue) =>
        issue.includes("version info is unavailable") ||
        issue.includes("capabilities info is unavailable"),
    );

  if (hasResolvedRuntime && missingDesktopContract) {
    return {
      summary:
        "AI Switch found a runtime binary, but it does not support the desktop integration features required by this release.",
      nextStep:
        "Open Settings and switch back to the bundled runtime, or choose a newer compatible runtime before continuing.",
    };
  }

  if (hasResolvedRuntime) {
    return {
      summary:
        "AI Switch found a runtime binary, but it is not compatible with this desktop build.",
      nextStep:
        "Open Settings and switch back to the bundled runtime, or choose a compatible runtime before continuing.",
    };
  }

  return {
    summary: "AI Switch could not use the selected runtime.",
    nextStep:
      "Open Settings and switch to a working bundled runtime or choose an advanced override before continuing.",
  };
}

function sectionTitle(section: string) {
  switch (section) {
    case "overview":
      return "Overview";
    case "profiles":
      return "Profiles";
    case "sets":
      return "Sets";
    case "diagnostics":
      return "Diagnostics";
    case "backups":
      return "Backups";
    case "activity":
      return "Activity";
    case "settings":
      return "Settings";
    default:
      return "AI Switch";
  }
}
