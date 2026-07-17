import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppFrame } from "./components/AppFrame";
import { APP_FRAME_MODES } from "./components/app-frame-display";
import { HelpSheet } from "./components/HelpSheet";
import { QuickSwitchPalette } from "./components/QuickSwitchPalette";
import { SectionCard } from "./components/SectionCard";
import {
  clearLastCommandResults,
  recordCommandResult,
  type CommandResultScope,
  useLastCommandResults,
} from "./features/shared/lastCommandResult";
import { COMMAND_RESULT_GLOBAL_IDS } from "./features/shared/command-result-scope";
import { normalizeRuntimeLanguage } from "./features/shared/runtime-language";
import { BackupsPanel } from "./features/backups/components/BackupsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/components/DiagnosticsPanel";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import { shouldShowSetupFlow } from "./features/onboarding/onboarding-display";
import { OverviewPanel } from "./features/overview/components/OverviewPanel";
import { ProfilesPanel } from "./features/profiles/components/ProfilesPanel";
import { ActivityPanel } from "./features/activity/components/ActivityPanel";
import { SetsPanel } from "./features/sets/components/SetsPanel";
import {
  diagnosticExportFailureNotification,
  diagnosticExportSuccessNotification,
} from "./features/diagnostics/diagnostics-copy";
import {
  invalidateCoreDesktopQueries,
  invalidateDiagnosticDesktopQueries,
  invalidatePostMutationQueries,
} from "./features/shared/postMutationRefresh";
import { SettingsPanel } from "./features/settings/components/SettingsPanel";
import { useDesktop } from "./features/shared/useDesktop";
import { notifyDesktop } from "./lib/notifications";
import {
  DESKTOP_MENU_EVENTS,
  DESKTOP_TRAY_EVENTS,
} from "./lib/desktop-event-contract";
import {
  REFERENCE_DOCUMENT_KIND_DOCUMENTATION,
  REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING,
} from "./lib/desktop-command-contract";
import { APP_NAV_IDS, type AppNavId } from "./lib/app-navigation";
import { activeSetLabel } from "./lib/profile-display";
import {
  SETTINGS_SECTION_IDS,
  type SettingsSection,
} from "./lib/settings-sections";
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
  createProfileSetupRouteState,
  createProfilesRouteState,
  createSettingsRouteState,
  describeBootstrapError,
  describeRuntimeBlocker,
  deriveAppShellState,
  REAPPLY_ACTIVE_PROFILE_LABEL,
  resolveDesktopShortcutAction,
  resolveActiveReapplyAction,
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
  const [desktopPreferences, setDesktopPreferences] =
    useState<DesktopPreferences>(loadDesktopPreferences);
  const [activeNav, setActiveNav] = useState<AppNavId>(
    () => desktopPreferences.defaultSection,
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
    setActiveNav(APP_NAV_IDS.settings);
  }

  function openOverview() {
    setActiveNav(APP_NAV_IDS.overview);
  }

  function openContexts() {
    setActiveNav(APP_NAV_IDS.sets);
  }

  function openDiagnostics(options?: { refresh?: boolean }) {
    setActiveNav(APP_NAV_IDS.diagnostics);
    if (options?.refresh) {
      invalidateDiagnostics();
    }
  }

  function openActivity() {
    setActiveNav(APP_NAV_IDS.activity);
  }

  function openBackups() {
    setActiveNav(APP_NAV_IDS.backups);
  }

  function openProfiles(routeState: ProfilesRouteState = createProfilesRouteState()) {
    setProfilesRouteState(routeState);
    setActiveNav(APP_NAV_IDS.profiles);
  }

  function openProfileSetup(
    routeState: Parameters<typeof createProfileSetupRouteState>[0] = {},
  ) {
    openProfiles(createProfileSetupRouteState(routeState));
  }

  function openImportCurrentLogin() {
    openProfiles(createImportCurrentLoginRouteState());
  }

  function selectNav(id: AppNavId) {
    if (id === APP_NAV_IDS.profiles) {
      openProfiles();
      return;
    }
    if (id === APP_NAV_IDS.settings) {
      openSettings();
      return;
    }
    setActiveNav(id);
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

  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveDesktopShortcutAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        editableTarget: isEditableTarget(event.target),
        runtimeBlocked: runtimeBlockedForShortcuts,
      });
      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "quick-switch") {
        setQuickSwitchOpen(true);
        return;
      }
      if (action === "settings") {
        openSettings();
        return;
      }
      selectNav(action);
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
      await notifyDesktop(diagnosticExportSuccessNotification(result.filename));
    },
    onError: async (error) => {
      await notifyDesktop(diagnosticExportFailureNotification(error));
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
        { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.profileSet },
        reapplyError.result,
      );
      await notifyDesktop({
        title: REAPPLY_ACTIVE_PROFILE_LABEL,
        body: reapplyError.notificationBody,
      });
    },
  });

  function invalidateDiagnostics() {
    void invalidateDiagnosticDesktopQueries(queryClient);
  }

  useEffect(() => {
    const desktopEventHandlers: DesktopEventHandler[] = [
      {
        event: DESKTOP_TRAY_EVENTS.openDiagnostics,
        handler: () => openDiagnostics(),
      },
      {
        event: DESKTOP_TRAY_EVENTS.runDiagnostics,
        handler: () => openDiagnostics({ refresh: true }),
      },
      {
        event: DESKTOP_MENU_EVENTS.openSettings,
        handler: () => openSettings(SETTINGS_SECTION_IDS.runtime),
      },
      {
        event: DESKTOP_MENU_EVENTS.openSettingsUpdates,
        handler: () => openSettings(SETTINGS_SECTION_IDS.updates),
      },
      {
        event: DESKTOP_MENU_EVENTS.openProfiles,
        handler: () => openProfiles(),
      },
      {
        event: DESKTOP_MENU_EVENTS.openAddProfile,
        handler: () => {
          openAddProfile();
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.openImportCurrentLogin,
        handler: () => openImportCurrentLogin(),
      },
      { event: DESKTOP_MENU_EVENTS.openOverview, handler: () => openOverview() },
      { event: DESKTOP_MENU_EVENTS.openSets, handler: () => setActiveNav(APP_NAV_IDS.sets) },
      {
        event: DESKTOP_MENU_EVENTS.openDiagnostics,
        handler: () => openDiagnostics(),
      },
      {
        event: DESKTOP_MENU_EVENTS.runVerify,
        handler: () => openDiagnostics({ refresh: true }),
      },
      { event: DESKTOP_MENU_EVENTS.openBackups, handler: () => openBackups() },
      { event: DESKTOP_MENU_EVENTS.openActivity, handler: () => openActivity() },
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
            .then((result) => notifyDesktop(diagnosticExportSuccessNotification(result.filename)))
            .catch((error) => notifyDesktop(diagnosticExportFailureNotification(error)));
        },
      },
      {
        event: DESKTOP_MENU_EVENTS.openTroubleshooting,
        handler: () => {
          void openReferenceDocument(REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING).catch(() => {
            openDiagnostics({ refresh: true });
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
    await invalidateCoreDesktopQueries(queryClient);
  }

  function runVerifyFlow() {
    openDiagnostics({ refresh: true });
  }

  function openAddProfile() {
    setProfilesRouteState((current) => createAddProfileRouteState(current));
    setActiveNav(APP_NAV_IDS.profiles);
  }

  function reopenSetupAssistant() {
    setDesktopPreferences((current) => ({
      ...current,
      reopenSetupAssistant: true,
    }));
    openOverview();
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
      defaultSection: APP_NAV_IDS.overview,
      reopenSetupAssistant: true,
    }));
    openOverview();
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
      mode={showSetupWindow ? APP_FRAME_MODES.setup : APP_FRAME_MODES.standard}
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
          initialSection={SETTINGS_SECTION_IDS.runtime}
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
                openProfileSetup({ tool, mode: options?.mode });
              }}
              onOpenSettings={openSettings}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.overview && !setupFocused ? (
            <OverviewPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              onOpenContexts={openContexts}
              onOpenQuickSwitch={() => setQuickSwitchOpen(true)}
              onOpenActivity={openActivity}
              onOpenProfiles={(tool, expandedProfile, options) => {
                openProfiles(
                  createProfilesRouteState({ tool, expandedProfile, mode: options?.mode }),
                );
              }}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.profiles ? (
            <ProfilesPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              initialTool={profilesRouteState.tool}
              initialExpandedProfile={profilesRouteState.expandedProfile}
              initialMode={profilesRouteState.mode}
              initialCredentialBackend={profilesRouteState.credentialBackend}
              openToken={profilesRouteState.openToken}
              onOpenBackups={openBackups}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.sets ? (
            <SetsPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              onOpenContexts={openContexts}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.diagnostics ? (
            <DiagnosticsPanel
              settings={settings}
              snapshot={resolvedSnapshot}
              toolCapabilities={toolCapabilities}
              onOpenSettings={openSettings}
              onOpenContexts={openContexts}
              onOpenProfiles={(tool, expandedProfile) => {
                openProfiles(createProfilesRouteState({ tool, expandedProfile }));
              }}
              onOpenProfileSetup={(options) => {
                openProfileSetup({
                  tool: options?.tool,
                  mode: options?.mode,
                  credentialBackend: options?.credentialBackend ?? null,
                });
              }}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.backups ? (
            <BackupsPanel
              snapshot={resolvedSnapshot}
              settings={settings}
              toolCapabilities={toolCapabilities}
              onOpenProfiles={(tool, expandedProfile) => {
                openProfiles(createProfilesRouteState({ tool, expandedProfile }));
              }}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.activity ? (
            <ActivityPanel
              externalClearSignal={activityClearSignal}
              externalOpenLogSignal={activityOpenLogSignal}
            />
          ) : null}
          {activeSection === APP_NAV_IDS.settings ? (
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
      onOpenProfiles={() => openProfiles()}
      onOpenDiagnostics={() => openDiagnostics()}
      onOpenSettings={() => openSettings()}
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
