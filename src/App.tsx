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
import {
  profileDisplayLabel,
  profileSetDisplayLabel,
  profileSetIsActive,
  sharedProfileEntries,
  toolProfileDisplayLabel,
} from "./lib/profile-display";
import { DesktopCommandError } from "./lib/tauri";
import { listenDesktopEvent, type TrayCommandResultEvent } from "./lib/tauri";
import { subscribeDesktopEvents, type DesktopEventHandler } from "./lib/desktop-events";
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
import type { ProfileImportMode } from "./features/shared/profile-capabilities";
import {
  applyAppearancePreference,
  loadDesktopPreferences,
  saveDesktopPreferences,
  type DesktopPreferences,
} from "./lib/desktop-preferences";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "./lib/schemas";
import { resolveGlobalStateMode, resolveStateModeRequest } from "./features/shared/state-modes";
import { titleCase } from "./lib/utils";
import {
  describeBootstrapError,
  describeRuntimeBlocker,
  navShortcutLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
  sectionDetail,
  sectionTitle,
  settingsForRecovery,
} from "./app-shell";

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

const NAV_SHORTCUTS: Record<string, (typeof NAV)[number]["id"]> = {
  "1": "overview",
  "2": "profiles",
  "3": "sets",
  "4": "diagnostics",
  "5": "backups",
  "6": "activity",
};

type ProfilesRouteState = {
  tool?: string;
  expandedProfile?: string | null;
  mode?: ProfileImportMode;
  credentialBackend?: "file" | "system-keyring" | null;
  openToken?: number;
};

type SettingsRouteState = {
  section?: SettingsSection;
};

export function App() {
  const queryClient = useQueryClient();
  const lastCommandResults = useLastCommandResults();
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopPreferences>(() =>
    loadDesktopPreferences(),
  );
  const [activeNav, setActiveNav] = useState<(typeof NAV)[number]["id"]>(
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
    void setTrayVisibility(desktopPreferences.showMenuBarIcon);
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

      const navShortcut = NAV_SHORTCUTS[key];
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
        body: error instanceof Error ? error.message : "AI Switch could not complete that action.",
      });
    },
  });

  const reapplyActiveProfileMutation = useMutation({
    mutationFn: async (): Promise<{
      scope: CommandResultScope;
      message: string;
      resultLabel: string;
    }> => {
      const context = reapplyContextRef.current;
      if (!context.snapshot || !context.settings || context.runtimeBlocked) {
        throw new Error("No active desktop snapshot is available yet.");
      }
      const resolvedSnapshot = context.snapshot;
      const settings = context.settings;
      const toolCapabilities = context.toolCapabilities;

      const activeSet = [...(settings.profile_sets ?? [])]
        .sort((left, right) => left.name.localeCompare(right.name))
        .find((set) => profileSetIsActive(resolvedSnapshot, set));
      if (activeSet) {
        await activateProfileSet({ name: activeSet.name, label: profileSetDisplayLabel(activeSet) });
        return {
          scope: { type: "global", id: "profile-set" },
          resultLabel: "Re-apply active profile",
          message: `Re-applied current set ${profileSetDisplayLabel(activeSet)}.`,
        };
      }

      const activeProfiles = resolvedSnapshot.statuses
        .map((status) => status.active_profile?.trim())
        .filter((profile): profile is string => Boolean(profile));
      const uniqueProfiles = [...new Set(activeProfiles)].sort((left, right) =>
        left.localeCompare(right),
      );
      if (
        uniqueProfiles.length === 1 &&
        sharedProfileEntries(settings, resolvedSnapshot).some(
          (entry) => entry.name === uniqueProfiles[0],
        )
      ) {
        const profile = uniqueProfiles[0];
        const profileLabel = profileDisplayLabel(settings, resolvedSnapshot, profile);
        await useAllProfiles({
          profile,
          stateMode: resolveGlobalStateMode(resolvedSnapshot),
          label: profileLabel,
        });
        return {
          scope: { type: "global", id: "switch-all" },
          resultLabel: "Re-apply active profile",
          message: `Re-applied shared profile ${profileLabel}.`,
        };
      }

      const activeStatuses = resolvedSnapshot.statuses.filter(
        (status): status is (typeof resolvedSnapshot.statuses)[number] & { active_profile: string } =>
          Boolean(status.active_profile?.trim()),
      );
      if (activeStatuses.length === 1) {
        const status = activeStatuses[0];
        const profile = status.active_profile.trim();
        const profileLabel = toolProfileDisplayLabel(settings, resolvedSnapshot, status.tool, profile);
        await useProfile({
          tool: status.tool,
          profile,
          stateMode: resolveStateModeRequest(status.tool, toolCapabilities, status.state_mode),
          label: profileLabel,
        });
        return {
          scope: { type: "tool", tool: status.tool },
          resultLabel: "Re-apply active profile",
          message: `Re-applied ${titleCase(status.tool)} profile ${profileLabel}.`,
        };
      }

      throw new Error("AI Switch could not determine a single active profile to re-apply.");
    },
    onSuccess: async ({ scope, resultLabel, message }) => {
      recordCommandResult(scope, {
        label: resultLabel,
        status: "success",
        message,
      });
      await notifyDesktop({
        title: "Re-apply active profile",
        body: message,
      });
      await invalidatePostMutationQueries(queryClient);
    },
    onError: async (error) => {
      const message = error instanceof Error ? error.message : "AI Switch could not complete that action.";
      recordCommandResult(
        { type: "global", id: "profile-set" },
        {
          label: "Re-apply active profile",
          status: "error",
          message,
          kind: error instanceof DesktopCommandError ? error.kind : undefined,
          remediation: error instanceof DesktopCommandError ? error.remediation : undefined,
        },
      );
      await notifyDesktop({
        title: "Re-apply active profile",
        body:
          error instanceof DesktopCommandError && error.remediation
            ? `${error.message} ${error.remediation}`
            : message,
      });
    },
  });

  function invalidateDiagnostics() {
    for (const queryKey of DIAGNOSTICS_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  }

  useEffect(() => {
    const desktopEventHandlers: DesktopEventHandler[] = [
      { event: "tray-open-diagnostics", handler: () => setActiveNav("diagnostics") },
      {
        event: "tray-run-diagnostics",
        handler: () => {
          setActiveNav("diagnostics");
          invalidateDiagnostics();
        },
      },
      { event: "menu-open-settings", handler: () => openSettings("runtime") },
      { event: "menu-open-settings-updates", handler: () => openSettings("updates") },
      {
        event: "menu-open-profiles",
        handler: () => {
          setProfilesRouteState({});
          setActiveNav("profiles");
        },
      },
      {
        event: "menu-open-add-profile",
        handler: () => {
          setProfilesRouteState({ tool: "claude", expandedProfile: null });
          setActiveNav("profiles");
        },
      },
      {
        event: "menu-open-import-current-login",
        handler: () => {
          setProfilesRouteState({ tool: "claude", expandedProfile: null, mode: "from_live" });
          setActiveNav("profiles");
        },
      },
      { event: "menu-open-overview", handler: () => setActiveNav("overview") },
      { event: "menu-open-sets", handler: () => setActiveNav("sets") },
      { event: "menu-open-diagnostics", handler: () => setActiveNav("diagnostics") },
      {
        event: "menu-run-verify",
        handler: () => {
          setActiveNav("diagnostics");
          invalidateDiagnostics();
        },
      },
      { event: "menu-open-backups", handler: () => setActiveNav("backups") },
      { event: "menu-open-activity", handler: () => setActiveNav("activity") },
      { event: "menu-open-quick-switch", handler: () => setQuickSwitchOpen(true) },
      {
        event: "menu-open-help",
        handler: () => {
          void openReferenceDocument("documentation").catch(() => {
            setHelpOpen(true);
          });
        },
      },
      {
        event: "menu-export-diagnostics",
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
                body: error instanceof Error ? error.message : "AI Switch could not complete that action.",
              }),
            );
        },
      },
      {
        event: "menu-open-troubleshooting",
        handler: () => {
          void openReferenceDocument("troubleshooting").catch(() => {
            setActiveNav("diagnostics");
            invalidateDiagnostics();
          });
        },
      },
      {
        event: "menu-open-issues",
        handler: () => {
          void openIssueTracker().catch(() => {
            exportDiagnosticBundleMutation.mutate();
          });
        },
      },
      {
        event: "menu-reapply-active-profile",
        handler: () => {
          reapplyActiveProfileMutation.mutate();
        },
      },
      {
        event: "tray-command-result",
        handler: (payload) => {
          const event = payload as TrayCommandResultEvent;
          const normalizedMessage = normalizeRuntimeLanguage(event.message);
          const normalizedRemediation = normalizeRuntimeLanguage(event.remediation);
          const normalizedLabel =
            event.scope === "global" && event.id === "context"
              ? "Use set"
              : normalizeRuntimeLanguage(event.label);

          if (event.scope === "tool") {
            recordCommandResult(
              { type: "tool", tool: event.tool },
              {
                label: normalizedLabel,
                status: event.status,
                message: normalizedMessage,
                kind: "kind" in event && typeof event.kind === "string" ? event.kind : undefined,
                remediation: normalizedRemediation,
              },
            );
          } else {
            recordCommandResult(
              { type: "global", id: event.id },
              {
                label: normalizedLabel,
                status: event.status,
                message: normalizedMessage,
                kind: "kind" in event && typeof event.kind === "string" ? event.kind : undefined,
                remediation: normalizedRemediation,
              },
            );
          }

          void notifyDesktop({
            title: normalizedLabel,
            body:
              event.status === "success"
                ? normalizedMessage
                : [normalizedMessage, normalizedRemediation].filter(Boolean).join(" "),
          });
          void invalidatePostMutationQueries(queryClient);
        },
      },
    ];

    return subscribeDesktopEvents(desktopEventHandlers, listenDesktopEvent);
  }, [queryClient]);

  if (bootstrap.isLoading) {
    return (
      <BootstrapSurface
        kicker="AI Switch"
        title="Preparing your local switchboard…"
        detail="Loading saved profiles and the current tool state on this computer."
        status="Opening local state"
        summary="This stays on-device and usually finishes in a moment."
      />
    );
  }

  if (bootstrap.isError || !bootstrap.data) {
    const bootstrapError = describeBootstrapError(bootstrap.error);
    return (
      <BootstrapSurface
        kicker="AI Switch"
        title="AI Switch could not open this window."
        detail="Check app setup, local permissions, and compatibility details before continuing."
        status="Needs attention"
        summary={bootstrapError.message}
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
    shortcut: navShortcutLabel(id),
  }));
  const runtimeBlocker = describeRuntimeBlocker(runtimeStatus);
  const showSetupWindow = setupFocused || runtimeRecoveryFocused;
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
    setProfilesRouteState((current) => ({
      tool: "claude",
      expandedProfile: null,
      openToken: (current.openToken ?? 0) + 1,
    }));
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
    setProfilesRouteState({});
    setSettingsRouteState({});
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

  function renderToolbar() {
    if (showSetupWindow) {
      return undefined;
    }

    if (activeSection === "backups") {
      return undefined;
    }

    if (activeSection === "activity") {
      return undefined;
    }

    if (activeSection === "settings") {
      return undefined;
    }

    if (activeSection === "profiles") {
      return undefined;
    }

    if (activeSection === "overview") {
      return (
        <div className="button-row toolbar-action-row">
          <button
            className="primary-button"
            type="button"
            disabled={runtimeBlocked}
            onClick={() => setQuickSwitchOpen(true)}
          >
            <span>Quick Switch</span>
            <kbd aria-hidden="true">⌘K</kbd>
          </button>
          <button className="ghost-button" type="button" onClick={runVerifyFlow}>
            <span>Verify</span>
          </button>
        </div>
      );
    }

    return (
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
        <button className="ghost-button" type="button" onClick={runVerifyFlow}>
          <span>Verify</span>
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={runtimeBlocked}
          onClick={openAddProfile}
        >
          <span>Add Profile</span>
        </button>
      </div>
    );
  }

  return (
    <>
    <AppFrame
      mode={showSetupWindow ? "setup" : "standard"}
      title={
        runtimeRecoveryFocused ? "Finish Setup" : sectionTitle(activeSection, setupFocused)
      }
      subtitle="Manage Claude Code, Codex CLI, and Gemini CLI identities locally."
      detail={
        runtimeRecoveryFocused
          ? "AI Switch can continue as soon as it switches back to the included desktop engine."
          : sectionDetail(activeSection, setupFocused)
      }
      nav={navItems}
      activeNav={activeSection}
      onSelectNav={selectNav}
      toolbar={renderToolbar()}
      statusBadge={showSetupWindow ? undefined : (
        <div className="sidebar-status-stack">
          <div className="sidebar-status-header">
            <span className="sidebar-status-kicker">Current state</span>
          </div>
          <div className="sidebar-status-grid">
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
        </div>
      )}
    >
      {runtimeRecoveryFocused ? (
        <SectionCard title="Finish setup" kicker="Desktop engine required">
          <div className="stack-list">
            <p className="inline-note">
              AI Switch Desktop uses the included switching engine. A separate command-line install
              on this Mac cannot power this app yet.
            </p>
            <p className="inline-note">
              Your saved profiles stay local. Switch back to the included desktop engine to continue,
              or open Engine Settings only if you intentionally manage another compatible engine.
            </p>
            <div className="settings-summary-grid">
              <div>
                <span className="overview-current-set-cell-label">Using now</span>
                <strong>{runtimeSelectionLabel(settings.runtime_kind)}</strong>
              </div>
              <div>
                <span className="overview-current-set-cell-label">Desktop app needs</span>
                <strong>Included desktop engine</strong>
              </div>
              <div>
                <span className="overview-current-set-cell-label">Next step</span>
                <strong>{normalizeRuntimeLanguage(runtimeBlocker.nextStep)}</strong>
              </div>
            </div>
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
                Engine Settings
              </button>
            </div>
            {restoreBundledRuntimeMutation.error ? (
              <p className="inline-note">
                {describeBootstrapError(restoreBundledRuntimeMutation.error).message}
              </p>
            ) : null}
            <details className="diagnostic-card runtime-blocker-details">
              <summary>Why setup paused</summary>
              <div className="stack-list">
                <p className="inline-note">{normalizeRuntimeLanguage(runtimeBlocker.summary)}</p>
                {runtimeStatus.issues.length ? (
                  runtimeStatus.issues.map((issue) => (
                    <p key={issue} className="inline-note">
                      {normalizeRuntimeLanguage(issue)}
                    </p>
                  ))
                ) : (
                  <p className="inline-note">No additional compatibility details were reported.</p>
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
              onOpenActivity={() => setActiveNav("activity")}
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
        <SectionCard title="Waiting for snapshot" kicker="Bootstrap">
          <p className="inline-note">The desktop engine is compatible, but no state snapshot is available yet.</p>
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
        setProfilesRouteState({});
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
              <span className="overview-current-set-cell-label">Status</span>
              <strong>{status}</strong>
              <p className="inline-note">{summary}</p>
            </div>
            {remediation ? (
              <div className="launch-status-panel">
                <span className="overview-current-set-cell-label">Next step</span>
                <strong>Review setup</strong>
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
