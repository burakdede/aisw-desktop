import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppFrame } from "./components/AppFrame";
import { HelpSheet } from "./components/HelpSheet";
import { QuickSwitchPalette } from "./components/QuickSwitchPalette";
import { SectionCard } from "./components/SectionCard";
import {
  clearLastCommandResults,
  recordCommandResult,
  type CommandResultScope,
  useLastCommandResults,
} from "./features/shared/lastCommandResult";
import { normalizeRuntimeLanguage } from "./features/shared/runtime-language";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import { shouldShowSetupFlow } from "./features/onboarding/onboarding-display";
import { OverviewPanel } from "./features/overview/components/OverviewPanel";
import { ProfilesPanel } from "./features/profiles/components/ProfilesPanel";
import { ActivityPanel } from "./features/activity/components/ActivityPanel";
import { SetsPanel } from "./features/sets/components/SetsPanel";
import { invalidatePostMutationQueries } from "./features/shared/postMutationRefresh";
import { SettingsPanel } from "./features/settings/components/SettingsPanel";
import type { SettingsSection } from "./features/settings/settings-panel-display";
import { useDesktop } from "./features/shared/useDesktop";
import { notifyDesktop } from "./lib/notifications";
import { DEFAULT_ACTION_FAILURE_MESSAGE } from "./lib/display-copy";
import {
  DESKTOP_DIAGNOSTIC_QUERY_KEYS,
  DESKTOP_MENU_EVENTS,
  DESKTOP_TRAY_EVENTS,
} from "./lib/desktop-event-contract";
import {
  REFERENCE_DOCUMENT_KIND_DOCUMENTATION,
  REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING,
} from "./lib/desktop-command-contract";
import { activeSetLabel } from "./lib/profile-display";
import { listenDesktopEvent } from "./lib/tauri";
import { subscribeDesktopEvents, type DesktopEventHandler } from "./lib/desktop-events";
import { buildBundledRuntimeSettingsUpdate } from "./lib/desktop-settings";
import { syncWindowState } from "./lib/window-state";
import {
  activateProfileSet,
  exportDiagnosticBundle,
  openReferenceDocument,
  openIssueTracker,
  updateSettings,
  useAllProfiles,
  useProfile,
  setTrayVisibility,
} from "./lib/client";
import {
  applyAppearancePreference,
  loadDesktopPreferences,
  saveDesktopPreferences,
  type DesktopPreferences,
} from "./lib/desktop-preferences";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "./lib/schemas";
import {
  APP_SHELL_COPY,
  appNavFromShortcut,
  buildBootstrapErrorSurface,
  buildBootstrapLoadingSurface,
  buildReapplyActiveProfileError,
  buildRuntimeRecoveryStatusRows,
  buildSidebarStatusRows,
  buildTrayCommandFeedback,
  buildToolbarActions,
  buildAppNavItems,
  createAddProfileRouteState,
  createImportCurrentLoginRouteState,
  createProfilesRouteState,
  createSettingsRouteState,
  describeBootstrapError,
  describeRuntimeBlocker,
  deriveAppShellState,
  REAPPLY_ACTIVE_PROFILE_LABEL,
  resolveActiveReapplyAction,
  type AppNavId,
  type ToolbarAction,
  type ProfilesRouteState,
  sectionDetail,
  sectionTitle,
  settingsForRecovery,
  runtimeRecoveryPrimaryActionLabel,
  type SettingsRouteState,
} from "./app-shell";

export function App() {
  const queryClient = useQueryClient();
  const lastCommandResults = useLastCommandResults();
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopPreferences>(() =>
    loadDesktopPreferences(),
  );
  const [activeNav, setActiveNav] = useState<AppNavId>(
    () => loadDesktopPreferences().defaultSection,
  );
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profilesRouteState, setProfilesRouteState] = useState<ProfilesRouteState>({});
  const [settingsRouteState, setSettingsRouteState] = useState<SettingsRouteState>({});
  const [runtimeRecoveryOpen, setRuntimeRecoveryOpen] = useState(false);
  const [activityClearSignal, setActivityClearSignal] = useState(0);
  const [activityOpenLogSignal, setActivityOpenLogSignal] = useState(0);
  const { bootstrap, snapshot, init } = useDesktop();
  const reapplyContextRef = useRef<{
    snapshot: AppSnapshot | null;
    settings: DesktopSettings | null;
    toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
    runtimeBlocked: boolean;
  }>({
    snapshot: null,
    settings: null,
    toolCapabilities: {},
    runtimeBlocked: true,
  });

  function openSettings(section?: SettingsSection) {
    setSettingsRouteState(createSettingsRouteState(section));
    setRuntimeRecoveryOpen(true);
    setActiveNav("settings");
  }

  function openContexts() {
    setActiveNav("sets");
  }

  function selectNav(id: string) {
    if (id === "profiles") {
      setProfilesRouteState(createProfilesRouteState());
    }
    if (id === "settings") {
      setSettingsRouteState(createSettingsRouteState());
      setRuntimeRecoveryOpen(true);
    }
    setActiveNav(id as AppNavId);
  }

  useEffect(() => {
    applyAppearancePreference(desktopPreferences.appearance);
    saveDesktopPreferences(desktopPreferences);
    void setTrayVisibility(desktopPreferences.showMenuBarIcon).catch(() => {
      // Keep the renderer usable when the native bridge is unavailable during dev startup.
    });
  }, [desktopPreferences]);

  useEffect(() => {
    if (!desktopPreferences.restoreWindowState) {
      return;
    }

    let dispose: (() => void) | undefined;

    void syncWindowState().then((cleanup) => {
      dispose = cleanup;
    });

    return () => {
      dispose?.();
    };
  }, [desktopPreferences.restoreWindowState]);

  const runtimeBlockedForShortcuts = bootstrap.data
    ? !bootstrap.data.runtime_status.compatible
    : true;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setQuickSwitchOpen(true);
        return;
      }

      if (key === "," || key === "<") {
        event.preventDefault();
        openSettings();
        return;
      }

      if (runtimeBlockedForShortcuts) {
        return;
      }

      const navShortcut = appNavFromShortcut(key);
      if (!navShortcut) {
        return;
      }
      event.preventDefault();
      selectNav(navShortcut);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtimeBlockedForShortcuts]);

  const restoreBundledRuntimeMutation = useMutation({
    mutationFn: async () =>
      updateSettings(
        buildBundledRuntimeSettingsUpdate(settingsForRecovery(bootstrap.data?.settings)),
      ),
    onSuccess: async () => {
      setRuntimeRecoveryOpen(false);
      await invalidatePostMutationQueries(queryClient);
    },
  });

  const exportDiagnosticBundleMutation = useMutation({
    mutationFn: exportDiagnosticBundle,
    onSuccess: async (result) => {
      await notifyDesktop({
        title: "Support report exported",
        body: `Saved ${result.filename}.`,
      });
    },
    onError: async (error) => {
      await notifyDesktop({
        title: "Support report export failed",
        body: error instanceof Error ? error.message : DEFAULT_ACTION_FAILURE_MESSAGE,
      });
    },
  });

  const reapplyActiveProfileMutation = useMutation({
    mutationFn: async (): Promise<{
      scope: CommandResultScope;
      message: string;
      resultLabel: string;
    }> => {
      const resolution = resolveActiveReapplyAction(reapplyContextRef.current);

      switch (resolution.action.kind) {
        case "set":
          await activateProfileSet({
            name: resolution.action.name,
            label: resolution.action.label,
          });
          break;
        case "shared-profile":
          await useAllProfiles({
            profile: resolution.action.profile,
            stateMode: resolution.action.stateMode,
            label: resolution.action.label,
          });
          break;
        case "tool-profile":
          await useProfile({
            tool: resolution.action.tool,
            profile: resolution.action.profile,
            stateMode: resolution.action.stateMode,
            label: resolution.action.label,
          });
          break;
      }

      return {
        scope: resolution.scope,
        resultLabel: resolution.resultLabel,
        message: resolution.message,
      };
    },
    onSuccess: async ({ scope, resultLabel, message }) => {
      recordCommandResult(scope, {
        label: resultLabel,
        status: "success",
        message,
      });
      await notifyDesktop({
        title: REAPPLY_ACTIVE_PROFILE_LABEL,
        body: message,
      });
      await invalidatePostMutationQueries(queryClient);
    },
    onError: async (error) => {
      const reapplyError = buildReapplyActiveProfileError(error);
      recordCommandResult(
        { type: "global", id: "profile-set" },
        reapplyError.result,
      );
      await notifyDesktop({
        title: REAPPLY_ACTIVE_PROFILE_LABEL,
        body: reapplyError.notificationBody,
      });
    },
  });

  function invalidateDiagnostics() {
    for (const queryKey of DESKTOP_DIAGNOSTIC_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  }

  useEffect(() => {
    const desktopEventHandlers: DesktopEventHandler[] = [
      {
        event: DESKTOP_TRAY_EVENTS.openDiagnostics,
        handler: () => setActiveNav("diagnostics"),
      },
      {
        event: DESKTOP_TRAY_EVENTS.runDiagnostics,
        handler: () => {
          setActiveNav("diagnostics");
          invalidateDiagnostics();
        },
      },
      { event: DESKTOP_MENU_EVENTS.openSettings, handler: () => openSettings("runtime") },
      {
        event: DESKTOP_MENU_EVENTS.openSettingsUpdates,
        handler: () => openSettings("updates"),
      },
      {
        event: DESKTOP_MENU_EVENTS.openProfiles,
        handler: () => {
          setProfilesRouteState(createProfilesRouteState());
          setActiveNav("profiles");
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.openAddProfile,
        handler: () => {
          setProfilesRouteState(createProfilesRouteState({ tool: "claude", expandedProfile: null }));
          setActiveNav("profiles");
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.openImportCurrentLogin,
        handler: () => {
          setProfilesRouteState(createImportCurrentLoginRouteState());
          setActiveNav("profiles");
        },
      },
      { event: DESKTOP_MENU_EVENTS.openOverview, handler: () => setActiveNav("overview") },
      { event: DESKTOP_MENU_EVENTS.openSets, handler: () => setActiveNav("sets") },
      {
        event: DESKTOP_MENU_EVENTS.openDiagnostics,
        handler: () => setActiveNav("diagnostics"),
      },
      {
        event: DESKTOP_MENU_EVENTS.runVerify,
        handler: () => {
          setActiveNav("diagnostics");
          invalidateDiagnostics();
        },
      },
      { event: DESKTOP_MENU_EVENTS.openBackups, handler: () => setActiveNav("backups") },
      { event: DESKTOP_MENU_EVENTS.openActivity, handler: () => setActiveNav("activity") },
      {
        event: DESKTOP_MENU_EVENTS.openQuickSwitch,
        handler: () => setQuickSwitchOpen(true),
      },
      {
        event: DESKTOP_MENU_EVENTS.openHelp,
        handler: () => {
          void openReferenceDocument(REFERENCE_DOCUMENT_KIND_DOCUMENTATION).catch(() => {
            setHelpOpen(true);
          });
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.exportDiagnostics,
        handler: () => {
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
                body: error instanceof Error ? error.message : DEFAULT_ACTION_FAILURE_MESSAGE,
              }),
            );
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.openTroubleshooting,
        handler: () => {
          void openReferenceDocument(REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING).catch(() => {
            setActiveNav("diagnostics");
            invalidateDiagnostics();
          });
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.openIssues,
        handler: () => {
          void openIssueTracker().catch(() => {
            exportDiagnosticBundleMutation.mutate();
          });
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.reapplyActiveProfile,
        handler: () => {
          reapplyActiveProfileMutation.mutate();
        },
      },
      {
        event: DESKTOP_TRAY_EVENTS.commandResult,
        handler: (payload) => {
          const feedback = buildTrayCommandFeedback(payload);
          recordCommandResult(feedback.scope, feedback.result);
          void notifyDesktop(feedback.notification);
          void invalidatePostMutationQueries(queryClient);
        },
      },
    ];

    return subscribeDesktopEvents(desktopEventHandlers, listenDesktopEvent);
  }, [queryClient]);

  if (bootstrap.isLoading) {
    const loadingSurface = buildBootstrapLoadingSurface();
    return (
      <BootstrapSurface
        kicker={loadingSurface.kicker}
        title={loadingSurface.title}
        detail={loadingSurface.detail}
        status={loadingSurface.status}
        summary={loadingSurface.summary}
      />
    );
  }

  if (bootstrap.isError || !bootstrap.data) {
    const bootstrapError = buildBootstrapErrorSurface(bootstrap.error);
    return (
      <BootstrapSurface
        kicker={bootstrapError.kicker}
        title={bootstrapError.title}
        detail={bootstrapError.detail}
        status="Needs attention"
        summary={bootstrapError.summary}
        remediation={bootstrapError.remediation}
      />
    );
  }

  const { runtime_status: runtimeStatus, settings } = bootstrap.data;
  const resolvedSnapshot = snapshot.data ?? bootstrap.data.snapshot;
  const toolCapabilities = runtimeStatus.capabilities?.tools ?? {};
  const currentActiveSet = resolvedSnapshot ? activeSetLabel(settings, resolvedSnapshot) : null;
  const setupForced = desktopPreferences.reopenSetupAssistant;
  const setupRequired = resolvedSnapshot
    ? shouldShowSetupFlow(resolvedSnapshot, init.data, setupForced)
    : false;
  const runtimeBlocked = !runtimeStatus.compatible;
  const { activeSection, runtimeRecoveryFocused, setupFocused, showSetupWindow } =
    deriveAppShellState({
      activeNav,
      runtimeBlocked,
      runtimeRecoveryOpen,
      setupRequired,
    });
  const navItems = buildAppNavItems(runtimeBlocked);
  const runtimeBlocker = describeRuntimeBlocker(runtimeStatus);
  const sidebarStatusRows = buildSidebarStatusRows({
    currentActiveSet,
    runtimeCompatible: runtimeStatus.compatible,
    runtimeKind: settings.runtime_kind,
  });
  const toolbarActions = buildToolbarActions({
    activeSection,
    runtimeBlocked,
    showSetupWindow,
  });
  const runtimeRecoveryRows = buildRuntimeRecoveryStatusRows({
    runtimeKind: settings.runtime_kind,
    nextStep: runtimeBlocker.nextStep,
  });
  const hasActivityEntries =
    Object.values(lastCommandResults.global).some(Boolean) ||
    Object.values(lastCommandResults.tool).some(Boolean);
  reapplyContextRef.current = {
    snapshot: resolvedSnapshot ?? null,
    settings,
    toolCapabilities,
    runtimeBlocked,
  };

  async function retryRuntimeCheck() {
    await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["init"] });
  }

  function runVerifyFlow() {
    setActiveNav("diagnostics");
    invalidateDiagnostics();
  }

  function openAddProfile() {
    setProfilesRouteState((current) => createAddProfileRouteState(current));
    setActiveNav("profiles");
  }

  function reopenSetupAssistant() {
    setDesktopPreferences((current) => ({
      ...current,
      reopenSetupAssistant: true,
    }));
    setActiveNav("overview");
  }

  function resetOnboarding() {
    clearLastCommandResults();
    setProfilesRouteState(createProfilesRouteState());
    setSettingsRouteState(createSettingsRouteState());
    setQuickSwitchOpen(false);
    setHelpOpen(false);
    setRuntimeRecoveryOpen(false);
    setDesktopPreferences((current) => ({
      ...current,
      defaultSection: "overview",
      reopenSetupAssistant: true,
    }));
    setActiveNav("overview");
  }

  function closeSetupAssistant() {
    setDesktopPreferences((current) => ({
      ...current,
      reopenSetupAssistant: false,
    }));
  }

  function runToolbarAction(action: ToolbarAction) {
    switch (action.kind) {
      case "quick-switch":
        setQuickSwitchOpen(true);
        break;
      case "verify":
        runVerifyFlow();
        break;
      case "add-profile":
        openAddProfile();
        break;
    }
  }

  function renderToolbar() {
    if (!toolbarActions.length) {
      return undefined;
    }

    return (
      <div className="button-row toolbar-action-row">
        {toolbarActions.map((action) => (
          <button
            key={action.kind}
            className={action.tone === "primary" ? "primary-button" : "ghost-button"}
            type="button"
            disabled={action.disabled}
            onClick={() => runToolbarAction(action)}
          >
            <span>{action.label}</span>
            {action.shortcut ? <kbd aria-hidden="true">{action.shortcut}</kbd> : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
    <AppFrame
      mode={showSetupWindow ? "setup" : "standard"}
      title={
        runtimeRecoveryFocused ? APP_SHELL_COPY.runtimeRecovery.frameTitle : sectionTitle(activeSection, setupFocused)
      }
      subtitle={APP_SHELL_COPY.appSubtitle}
      detail={
        runtimeRecoveryFocused
          ? APP_SHELL_COPY.runtimeRecovery.frameDetail
          : sectionDetail(activeSection, setupFocused)
      }
      nav={navItems}
      activeNav={activeSection}
      onSelectNav={selectNav}
      toolbar={renderToolbar()}
      statusBadge={showSetupWindow ? undefined : (
        <div className="sidebar-status-stack">
          <div className="sidebar-status-header">
            <span className="sidebar-status-kicker">{APP_SHELL_COPY.currentStateKicker}</span>
          </div>
          <div className="sidebar-status-grid">
            {sidebarStatusRows.map((row) => (
              <div key={row.label} className="sidebar-status-row">
                <span className="sidebar-status-label">{row.label}</span>
                {row.label === "Active set" ? <strong>{row.value}</strong> : <p>{row.value}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    >
      {runtimeRecoveryFocused ? (
        <SectionCard
          title={APP_SHELL_COPY.runtimeRecovery.cardTitle}
          kicker={APP_SHELL_COPY.runtimeRecovery.cardKicker}
        >
          <div className="stack-list">
            <p className="inline-note">{APP_SHELL_COPY.runtimeRecovery.intro}</p>
            <p className="inline-note">{APP_SHELL_COPY.runtimeRecovery.guidance}</p>
            <div className="settings-summary-grid">
              {runtimeRecoveryRows.map((row) => (
                <div key={row.label}>
                  <span className="overview-current-set-cell-label">{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <div className="button-row">
              {settings.runtime_kind !== "bundled" ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={restoreBundledRuntimeMutation.isPending}
                  onClick={() => restoreBundledRuntimeMutation.mutate()}
                >
                  {runtimeRecoveryPrimaryActionLabel(restoreBundledRuntimeMutation.isPending)}
                </button>
              ) : null}
              <button className="ghost-button" type="button" onClick={() => void retryRuntimeCheck()}>
                {APP_SHELL_COPY.runtimeRecovery.retryLabel}
              </button>
              <button className="ghost-button" type="button" onClick={() => setRuntimeRecoveryOpen(true)}>
                {APP_SHELL_COPY.runtimeRecovery.settingsLabel}
              </button>
            </div>
            {restoreBundledRuntimeMutation.error ? (
              <p className="inline-note">
                {describeBootstrapError(restoreBundledRuntimeMutation.error).message}
              </p>
            ) : null}
            <details className="diagnostic-card runtime-blocker-details">
              <summary>{APP_SHELL_COPY.runtimeRecovery.detailsSummary}</summary>
              <div className="stack-list">
                <p className="inline-note">{normalizeRuntimeLanguage(runtimeBlocker.summary)}</p>
                {runtimeStatus.issues.length ? (
                  runtimeStatus.issues.map((issue) => (
                    <p key={issue} className="inline-note">
                      {normalizeRuntimeLanguage(issue)}
                    </p>
                  ))
                ) : (
                  <p className="inline-note">{APP_SHELL_COPY.runtimeRecovery.noIssuesLabel}</p>
                )}
              </div>
            </details>
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
          onReopenSetupAssistant={reopenSetupAssistant}
          onResetOnboarding={resetOnboarding}
        />
      ) : resolvedSnapshot ? (
        <>
          {setupFocused ? (
            <SetupPanel
              bootstrap={bootstrap.data}
              snapshot={resolvedSnapshot}
              initReport={init.data}
              forcedOpen={setupForced}
              onCloseSetup={closeSetupAssistant}
              onOpenProfiles={(tool, options) => {
                setProfilesRouteState(
                  createProfilesRouteState({ tool, expandedProfile: null, mode: options?.mode }),
                );
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
              onOpenActivity={() => setActiveNav("activity")}
              onOpenProfiles={(tool, expandedProfile, options) => {
                setProfilesRouteState(
                  createProfilesRouteState({ tool, expandedProfile, mode: options?.mode }),
                );
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
              openToken={profilesRouteState.openToken}
              onOpenBackups={() => {
                setActiveNav("backups");
              }}
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
                setProfilesRouteState(createProfilesRouteState({ tool, expandedProfile }));
                setActiveNav("profiles");
              }}
              onOpenProfileSetup={(options) => {
                setProfilesRouteState(
                  createProfilesRouteState({
                    tool: options?.tool,
                    expandedProfile: null,
                    mode: options?.mode,
                    credentialBackend: options?.credentialBackend ?? null,
                  }),
                );
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
                setProfilesRouteState(createProfilesRouteState({ tool, expandedProfile }));
                setActiveNav("profiles");
              }}
            />
          ) : null}
          {activeSection === "activity" ? (
            <ActivityPanel
              externalClearSignal={activityClearSignal}
              externalOpenLogSignal={activityOpenLogSignal}
            />
          ) : null}
          {activeSection === "settings" ? (
            <SettingsPanel
              settings={settings}
              runtimeStatus={runtimeStatus}
              initialSection={settingsRouteState.section}
              desktopPreferences={desktopPreferences}
              onUpdateDesktopPreferences={setDesktopPreferences}
              onReopenSetupAssistant={reopenSetupAssistant}
              onResetOnboarding={resetOnboarding}
            />
          ) : null}
        </>
      ) : (
        <SectionCard
          title={APP_SHELL_COPY.waitingSnapshot.title}
          kicker={APP_SHELL_COPY.waitingSnapshot.kicker}
        >
          <p className="inline-note">{APP_SHELL_COPY.waitingSnapshot.detail}</p>
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
    <HelpSheet
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      onOpenProfiles={() => {
        setProfilesRouteState(createProfilesRouteState());
        setActiveNav("profiles");
      }}
      onOpenDiagnostics={() => {
        setActiveNav("diagnostics");
      }}
      onOpenSettings={() => {
        openSettings();
      }}
    />
    </>
  );
}

function BootstrapSurface({
  kicker,
  title,
  detail,
  status,
  summary,
  remediation,
}: {
  kicker: string;
  title: string;
  detail: string;
  status: string;
  summary: string;
  remediation?: string;
}) {
  return (
    <main className="app-shell app-shell-launch">
      <section className="launch-card">
        <div className="launch-titlebar" aria-hidden="true">
          <span className="launch-traffic launch-traffic-close" />
          <span className="launch-traffic launch-traffic-minimize" />
          <span className="launch-traffic launch-traffic-zoom" />
        </div>
        <div className="launch-card-body">
          <div className="launch-card-copy">
            <p className="eyebrow">{kicker}</p>
            <h1>{title}</h1>
            <p className="lede">{detail}</p>
          </div>
          <div className="launch-card-status">
            <div className="launch-status-panel">
              <span className="overview-current-set-cell-label">
                {APP_SHELL_COPY.bootstrapSurface.statusLabel}
              </span>
              <strong>{status}</strong>
              <p className="inline-note">{summary}</p>
            </div>
            {remediation ? (
              <div className="launch-status-panel">
                <span className="overview-current-set-cell-label">
                  {APP_SHELL_COPY.bootstrapSurface.nextStepLabel}
                </span>
                <strong>{APP_SHELL_COPY.bootstrapSurface.error.nextStepTitle}</strong>
                <p className="inline-note">{remediation}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}
