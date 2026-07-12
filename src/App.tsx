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
    let dispose: (() => void) | undefined;

    void syncWindowState().then((cleanup) => {
      dispose = cleanup;
    });

    return () => {
      dispose?.();
    };
  }, []);

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

    void listenDesktopEvent("menu-open-help", () => {
      if (!active) return;
      void openReferenceDocument("documentation").catch(() => {
        if (!active) return;
        setHelpOpen(true);
      });
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
            body: error instanceof Error ? error.message : "AI Switch could not complete that action.",
          }),
        );
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-troubleshooting", () => {
      if (!active) return;
      void openReferenceDocument("troubleshooting").catch(() => {
        if (!active) return;
        setActiveNav("diagnostics");
        invalidateDiagnostics();
      });
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-open-issues", () => {
      if (!active) return;
      void openIssueTracker().catch(() => {
        if (!active) return;
        exportDiagnosticBundleMutation.mutate();
      });
    }).then((dispose) => {
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    });

    void listenDesktopEvent("menu-reapply-active-profile", () => {
      if (!active) return;
      reapplyActiveProfileMutation.mutate();
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
          ? "Use set"
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

  if (bootstrap.isLoading) {
    return (
      <main className="app-shell app-shell-onboarding">
        <section className="hero-card hero-card-compact">
          <p className="eyebrow">AI Switch</p>
          <h1>Preparing your local switchboard…</h1>
          <p className="lede">
            Loading saved profiles and the current tool state on this computer.
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
          <h1>AI Switch could not open this window.</h1>
          <p className="lede">
            Check app setup, local permissions, and compatibility details before continuing.
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
    setProfilesRouteState({ tool: "claude", expandedProfile: null });
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
      return (
        <div className="button-row toolbar-action-row">
          <button
            className="ghost-button"
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["backups"] })}
          >
            <span>Refresh</span>
          </button>
        </div>
      );
    }

    if (activeSection === "activity") {
      return (
        <div className="button-row toolbar-action-row">
          <button
            className="ghost-button"
            type="button"
            disabled={!hasActivityEntries}
            onClick={() => {
              clearLastCommandResults();
              setActivityClearSignal((value) => value + 1);
            }}
          >
            <span>Clear</span>
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={exportDiagnosticBundleMutation.isPending}
            onClick={() => exportDiagnosticBundleMutation.mutate()}
          >
            <span>
              {exportDiagnosticBundleMutation.isPending
                ? "Exporting…"
                : "Export Support Report"}
            </span>
          </button>
        </div>
      );
    }

    if (activeSection === "settings") {
      return undefined;
    }

    if (activeSection === "profiles") {
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
      subtitle="Switch Claude Code, Codex CLI, and Gemini CLI profiles from one focused app."
      detail={
        runtimeRecoveryFocused
          ? "AI Switch can continue as soon as this computer switches back to the included engine."
          : sectionDetail(activeSection, setupFocused)
      }
      nav={navItems}
      activeNav={activeSection}
      onSelectNav={selectNav}
      toolbar={renderToolbar()}
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
            <span className="sidebar-status-label">Runtime source</span>
            <p>{runtimeSourceLabel(settings.runtime_kind)}</p>
          </div>
        </div>
      )}
    >
      {runtimeRecoveryFocused ? (
        <SectionCard title="Switching is paused" kicker="Setup paused">
          <div className="stack-list">
            <p className="inline-note">
              This computer is pointed at an external switching engine that this desktop app cannot use
              safely.
            </p>
            <p className="inline-note">
              Switch back to the included engine to continue, or open Runtime Settings if you need
              to review the current source.
            </p>
            <div className="settings-summary-grid">
              <div>
                <span className="overview-current-set-cell-label">Current selection</span>
                <strong>{runtimeSelectionLabel(settings.runtime_kind)}</strong>
              </div>
              <div>
                <span className="overview-current-set-cell-label">Recommended</span>
                <strong>Included runtime</strong>
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
                Runtime Settings
              </button>
            </div>
            {restoreBundledRuntimeMutation.error ? (
              <p className="inline-note">
                {describeBootstrapError(restoreBundledRuntimeMutation.error).message}
              </p>
            ) : null}
            <details className="diagnostic-card runtime-blocker-details">
              <summary>Compatibility details</summary>
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
          {activeSection === "activity" ? (
            <ActivityPanel externalClearSignal={activityClearSignal} />
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

function navShortcutLabel(id: (typeof NAV)[number]["id"]) {
  switch (id) {
    case "overview":
      return "⌘1";
    case "profiles":
      return "⌘2";
    case "sets":
      return "⌘3";
    case "diagnostics":
      return "⌘4";
    case "backups":
      return "⌘5";
    case "activity":
      return "⌘6";
    case "settings":
      return "⌘,";
  }
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
        "The selected runtime does not report the desktop compatibility details this app needs.",
      nextStep:
        "Switch back to the included engine, or choose a newer compatible runtime in Runtime Settings before continuing.",
    };
  }

  if (hasResolvedRuntime) {
    return {
      summary:
        "The selected runtime was found, but it is not compatible with AI Switch.",
      nextStep:
        "Switch back to the included engine, or choose a compatible runtime in Runtime Settings before continuing.",
    };
  }

  return {
    summary: "AI Switch could not use the selected runtime.",
    nextStep:
      "Switch to the included engine, or choose a working runtime source in Runtime Settings before continuing.",
  };
}

function runtimeSelectionLabel(runtimeKind: AppBootstrap["settings"]["runtime_kind"]) {
  switch (runtimeKind) {
    case "bundled":
      return "Included runtime";
    case "system":
      return "System runtime override";
    case "custom":
      return "Custom runtime override";
    default:
      return "Unknown runtime";
  }
}

function sectionTitle(section: string, setupFocused = false) {
  if (setupFocused) {
    return "Get started";
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
    return "Set up AI Switch on this computer before you switch coding-agent profiles.";
  }
  switch (section) {
    case "overview":
      return "Review active accounts, shared sets, and switch readiness across every supported tool without leaving the main window.";
    case "profiles":
      return "Inspect saved logins, labels, storage mode, and safe activation details in a compact split-view inspector.";
    case "sets":
      return "Manage saved sets and project rules in one compact split view before switching a whole project identity.";
    case "diagnostics":
      return "Verify runtime health, identify drift, and follow guided repair steps when something blocks switching.";
    case "backups":
      return "Replay a previous profile state or restore the latest known-good backup without leaving the app.";
    case "activity":
      return "Track recent desktop actions, command outcomes, and changes applied by the runtime.";
    case "settings":
      return "Control app setup, updates, terminal integration, and local storage behavior.";
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
