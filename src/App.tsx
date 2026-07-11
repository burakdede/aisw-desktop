import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppFrame } from "./components/AppFrame";
import { QuickSwitchPalette } from "./components/QuickSwitchPalette";
import { SectionCard } from "./components/SectionCard";
import { recordCommandResult } from "./features/shared/lastCommandResult";
import { normalizeRuntimeLanguage } from "./features/shared/runtime-language";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import {
  SetupPanel,
  shouldShowSetupFlow,
} from "./features/onboarding/components/SetupPanel";
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
import { exportDiagnosticBundle, updateSettings } from "./lib/client";
import type { ProfileImportMode } from "./features/shared/profile-capabilities";
import {
  applyAppearancePreference,
  loadDesktopPreferences,
  saveDesktopPreferences,
  type DesktopPreferences,
} from "./lib/desktop-preferences";
import type { AppBootstrap } from "./lib/schemas";

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
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopPreferences>(() =>
    loadDesktopPreferences(),
  );
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]["id"]>(
    () => loadDesktopPreferences().defaultSection,
  );
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [profilesRouteState, setProfilesRouteState] = useState<ProfilesRouteState>({});
  const [settingsRouteState, setSettingsRouteState] = useState<SettingsRouteState>({});
  const [runtimeRecoveryOpen, setRuntimeRecoveryOpen] = useState(false);
  const { bootstrap, snapshot, init } = useDesktop();

  function openSettings(section?: SettingsSection) {
    setSettingsRouteState({ section });
    setRuntimeRecoveryOpen(true);
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
      setRuntimeRecoveryOpen(true);
    }
    setActiveNav(id as (typeof NAV)[number]["id"]);
  }

  useEffect(() => {
    applyAppearancePreference(desktopPreferences.appearance);
    saveDesktopPreferences(desktopPreferences);
  }, [desktopPreferences]);

  const restoreBundledRuntimeMutation = useMutation({
    mutationFn: async () =>
      updateSettings({
        runtime_kind: "bundled",
        runtime_path: null,
        aisw_home: settingsForRecovery(bootstrap.data?.settings).aisw_home ?? null,
        update_channel: settingsForRecovery(bootstrap.data?.settings).update_channel,
        profile_labels: settingsForRecovery(bootstrap.data?.settings).profile_labels,
        profile_sets: settingsForRecovery(bootstrap.data?.settings).profile_sets,
      }),
    onSuccess: async () => {
      setRuntimeRecoveryOpen(false);
      await invalidatePostMutationQueries(queryClient);
    },
  });

  useEffect(() => {
    let active = true;
    const disposers: Array<() => void> = [];
    const invalidateDiagnostics = () => {
      for (const queryKey of DIAGNOSTICS_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    };

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
      invalidateDiagnostics();
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-settings", () => {
      if (!active) return;
      openSettings("runtime");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-settings-updates", () => {
      if (!active) return;
      openSettings("updates");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-profiles", () => {
      if (!active) return;
      setProfilesRouteState({});
      setActiveNav("profiles");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-add-profile", () => {
      if (!active) return;
      setProfilesRouteState({ tool: "claude", expandedProfile: null });
      setActiveNav("profiles");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-import-current-login", () => {
      if (!active) return;
      setProfilesRouteState({ tool: "claude", expandedProfile: null, mode: "from_live" });
      setActiveNav("profiles");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-overview", () => {
      if (!active) return;
      setActiveNav("overview");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-sets", () => {
      if (!active) return;
      setActiveNav("sets");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-diagnostics", () => {
      if (!active) return;
      setActiveNav("diagnostics");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-run-verify", () => {
      if (!active) return;
      setActiveNav("diagnostics");
      invalidateDiagnostics();
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-backups", () => {
      if (!active) return;
      setActiveNav("backups");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-activity", () => {
      if (!active) return;
      setActiveNav("activity");
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-quick-switch", () => {
      if (!active) return;
      setQuickSwitchOpen(true);
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-export-diagnostics", () => {
      if (!active) return;
      void exportDiagnosticBundle()
        .then((result) =>
          notifyDesktop({
            title: "Diagnostic report exported",
            body: `Saved ${result.filename}.`,
          }),
        )
        .catch((error) =>
          notifyDesktop({
            title: "Diagnostic export failed",
            body: error instanceof Error ? error.message : "Desktop command failed.",
          }),
        );
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-troubleshooting", () => {
      if (!active) return;
      setActiveNav("diagnostics");
      invalidateDiagnostics();
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent<TrayCommandResultEvent>("tray-command-result", (payload) => {
      if (!active) return;
      const normalizedMessage = normalizeRuntimeLanguage(payload.message);
      const normalizedRemediation = normalizeRuntimeLanguage(payload.remediation);
      const normalizedLabel =
        payload.scope === "global" && payload.id === "context"
          ? "Use imported set"
          : normalizeRuntimeLanguage(payload.label);

      if (payload.scope === "tool") {
        recordCommandResult(
          { type: "tool", tool: payload.tool },
          {
            label: normalizedLabel,
            status: payload.status,
            message: normalizedMessage,
            kind: "kind" in payload && typeof payload.kind === "string" ? payload.kind : undefined,
            remediation: normalizedRemediation,
          },
        );
      } else {
        recordCommandResult(
          { type: "global", id: payload.id },
          {
            label: normalizedLabel,
            status: payload.status,
            message: normalizedMessage,
            kind: "kind" in payload && typeof payload.kind === "string" ? payload.kind : undefined,
            remediation: normalizedRemediation,
          },
        );
      }

      void notifyDesktop({
        title: normalizedLabel,
        body:
          payload.status === "success"
            ? normalizedMessage
            : [normalizedMessage, normalizedRemediation].filter(Boolean).join(" "),
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickSwitchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (bootstrap.isLoading) {
    return (
      <main className="app-shell app-shell-onboarding">
        <section className="hero-card hero-card-compact">
          <p className="eyebrow">AI Switch</p>
          <h1>Preparing your local switchboard…</h1>
          <p className="lede">
            Loading saved profiles, the included engine, and the current tool state on this Mac.
          </p>
        </section>
      </main>
    );
  }

  if (bootstrap.isError || !bootstrap.data) {
    const bootstrapError = describeBootstrapError(bootstrap.error);
    return (
      <main className="app-shell app-shell-onboarding">
        <section className="hero-card hero-card-compact">
          <p className="eyebrow">AI Switch</p>
          <h1>AI Switch could not open the desktop switchboard.</h1>
          <p className="lede">
            Check the included engine, local permissions, and compatibility details
            before continuing.
          </p>
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
  const setupRequired = resolvedSnapshot ? shouldShowSetupFlow(resolvedSnapshot, init.data) : false;
  const runtimeBlocked = !runtimeStatus.compatible;
  const runtimeRecoveryFocused = runtimeBlocked && !runtimeRecoveryOpen;
  const activeSection = runtimeBlocked
    ? runtimeRecoveryFocused
      ? "overview"
      : "settings"
    : activeNav;
  const setupFocused = setupRequired && activeSection === "overview";
  const navItems = NAV.map(({ id, label, group }) => ({
    id,
    label,
    group,
    disabled: runtimeBlocked && id !== "settings",
  }));
  const runtimeBlocker = describeRuntimeBlocker(runtimeStatus);
  const showSetupWindow = setupFocused || runtimeRecoveryFocused;

  async function retryRuntimeCheck() {
    await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["init"] });
  }

  return (
    <>
    <AppFrame
      mode={showSetupWindow ? "setup" : "standard"}
      title={
        runtimeRecoveryFocused ? "Engine Check" : sectionTitle(activeSection, setupFocused)
      }
      subtitle="Switch Claude Code, Codex CLI, and Gemini CLI profiles from one focused desktop app."
      detail={
        runtimeRecoveryFocused
          ? "Use a desktop-compatible switching engine before profile switching, diagnostics, and backups become available."
          : sectionDetail(activeSection, setupFocused)
      }
      nav={navItems}
      activeNav={activeSection}
      onSelectNav={selectNav}
      toolbar={showSetupWindow ? undefined : (
        <div className="button-row toolbar-action-row">
          <button
            className="ghost-button"
            type="button"
            disabled={runtimeBlocked}
            onClick={() => setQuickSwitchOpen(true)}
          >
            <span>Quick Switch</span>
            <kbd aria-hidden="true">⌘K</kbd>
          </button>
          <button className="ghost-button" type="button" onClick={() => setActiveNav("diagnostics")}>
            <span>Verify</span>
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={runtimeBlocked}
            onClick={() => {
              setProfilesRouteState({ tool: "claude", expandedProfile: null });
              setActiveNav("profiles");
            }}
          >
            <span>Add Profile</span>
          </button>
        </div>
      )}
      statusBadge={showSetupWindow ? undefined : (
        <div className="sidebar-status-stack">
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Active set</span>
            <strong>{currentActiveSet ?? "None"}</strong>
          </div>
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Switching</span>
            <p>{runtimeStatus.compatible ? "Ready" : "Needs attention"}</p>
          </div>
          <div className="sidebar-status-row">
            <span className="sidebar-status-label">Engine source</span>
            <p>{runtimeSourceLabel(settings.runtime_kind)}</p>
          </div>
        </div>
      )}
    >
      {runtimeRecoveryFocused ? (
        <SectionCard title="This engine is not ready for AI Switch yet" kicker="Action required">
          <div className="stack-list">
            <p className="inline-note">
              AI Switch found a switching engine, but this desktop release cannot use it for
              switching, diagnostics, backups, or shared sets yet.
            </p>
            <p className="inline-note">{normalizeRuntimeLanguage(runtimeBlocker.summary)}</p>
            <p className="inline-note">{normalizeRuntimeLanguage(runtimeBlocker.nextStep)}</p>
            <div className="button-row">
              {settings.runtime_kind !== "bundled" ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={restoreBundledRuntimeMutation.isPending}
                  onClick={() => restoreBundledRuntimeMutation.mutate()}
                >
                  {restoreBundledRuntimeMutation.isPending
                    ? "Switching to Included Engine…"
                    : "Use Included Engine"}
                </button>
              ) : null}
              <button className="ghost-button" type="button" onClick={() => void retryRuntimeCheck()}>
                Try Again
              </button>
              <button className="ghost-button" type="button" onClick={() => setRuntimeRecoveryOpen(true)}>
                Advanced Engine Settings
              </button>
            </div>
            {restoreBundledRuntimeMutation.error ? (
              <p className="inline-note">
                {describeBootstrapError(restoreBundledRuntimeMutation.error).message}
              </p>
            ) : null}
            {runtimeStatus.issues.length ? (
              <article className="diagnostic-card">
                <h3>Why setup is paused</h3>
                {runtimeStatus.issues.map((issue) => (
                  <p key={issue} className="inline-note">
                    {normalizeRuntimeLanguage(issue)}
                  </p>
                ))}
              </article>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {runtimeBlocked && !runtimeRecoveryFocused ? (
        <SettingsPanel
          settings={settings}
          runtimeStatus={runtimeStatus}
          initialSection="runtime"
          desktopPreferences={desktopPreferences}
          onUpdateDesktopPreferences={setDesktopPreferences}
        />
      ) : resolvedSnapshot ? (
        <>
          {setupFocused ? (
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
          ) : null}
          {activeSection === "overview" && !setupFocused ? (
            <OverviewPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              onOpenContexts={openContexts}
              onOpenQuickSwitch={() => setQuickSwitchOpen(true)}
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
              desktopPreferences={desktopPreferences}
              onUpdateDesktopPreferences={setDesktopPreferences}
            />
          ) : null}
        </>
      ) : (
        <SectionCard title="Waiting for snapshot" kicker="Bootstrap">
          <p className="inline-note">The runtime is compatible, but no state snapshot is available yet.</p>
        </SectionCard>
      )}
    </AppFrame>
    {!runtimeBlocked && resolvedSnapshot ? (
      <QuickSwitchPalette
        open={quickSwitchOpen}
        onClose={() => setQuickSwitchOpen(false)}
        settings={settings}
        snapshot={resolvedSnapshot}
        toolCapabilities={toolCapabilities}
      />
    ) : null}
    </>
  );
}

function settingsForRecovery(settings: AppBootstrap["settings"] | undefined) {
  return (
    settings ?? {
      runtime_kind: "bundled" as const,
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
    }
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
    message: "AI Switch could not load its local desktop state.",
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
        "The current engine was found, but it does not report the desktop compatibility details required by this release.",
      nextStep:
        "Switch back to the included engine, or choose a newer compatible engine in Advanced Engine Settings before continuing.",
    };
  }

  if (hasResolvedRuntime) {
    return {
      summary:
        "The current engine was found, but it is not compatible with this desktop build.",
      nextStep:
        "Switch back to the included engine, or choose a compatible engine in Advanced Engine Settings before continuing.",
    };
  }

  return {
    summary: "AI Switch could not use the current engine choice.",
    nextStep:
      "Switch to the included engine, or choose a working advanced override in Advanced Engine Settings before continuing.",
  };
}

function sectionTitle(section: string, setupFocused = false) {
  if (setupFocused) {
    return "Set Up AI Switch";
  }
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

function sectionDetail(section: string, setupFocused = false) {
  if (setupFocused) {
    return "Set up AI Switch on this Mac before you switch coding-agent profiles.";
  }
  switch (section) {
    case "overview":
      return "Review active accounts, shared sets, and switch readiness across every supported tool without leaving the main window.";
    case "profiles":
      return "Inspect saved logins, labels, storage mode, and safe activation details in a compact split-view inspector.";
    case "sets":
      return "Coordinate reusable work, personal, and client combinations before switching a whole project identity.";
    case "diagnostics":
      return "Verify runtime health, identify drift, and follow guided repair steps when something blocks switching.";
    case "backups":
      return "Replay a previous profile state or restore the latest known-good backup without leaving the app.";
    case "activity":
      return "Track recent desktop actions, command outcomes, and changes applied by the switching engine.";
    case "settings":
      return "Control the included engine, updates, terminal integration, and local storage behavior.";
    default:
      return "";
  }
}

function runtimeSourceLabel(runtimeKind: "bundled" | "system" | "custom") {
  switch (runtimeKind) {
    case "bundled":
      return "Included";
    case "system":
      return "System override";
    case "custom":
      return "Custom override";
    default:
      return "Included";
  }
}
