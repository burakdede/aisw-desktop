import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { SourceListPanel } from "../../../components/SourceListPanel";
import { SplitView } from "../../../components/SplitView";
import {
  exportDiagnosticBundle,
  getLaunchAtLoginStatus,
  getShellGuidance,
  openAppDataFolder,
  runDoctor,
  setLaunchAtLogin,
} from "../../../lib/client";
import {
  DEFAULT_DESKTOP_PREFERENCES,
  DEFAULT_SECTIONS,
  DESKTOP_APPEARANCES,
  type DesktopPreferences,
} from "../../../lib/desktop-preferences";
import { notifyDesktop } from "../../../lib/notifications";
import { DesktopCommandError } from "../../../lib/tauri";
import { DesktopSettings, AppBootstrap } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../../shared/terminal-integration-language";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";

export const SETTINGS_SECTIONS = [
  "general",
  "runtime",
  "shell",
  "keyring",
  "updates",
  "advanced",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function SettingsPanel({
  settings,
  runtimeStatus,
  initialSection,
  desktopPreferences,
  onUpdateDesktopPreferences,
  onReopenSetupAssistant,
  onResetOnboarding,
}: {
  settings: DesktopSettings;
  runtimeStatus: AppBootstrap["runtime_status"];
  initialSection?: SettingsSection;
  desktopPreferences?: DesktopPreferences;
  onUpdateDesktopPreferences?: (preferences: DesktopPreferences) => void;
  onReopenSetupAssistant?: () => void;
  onResetOnboarding?: () => void;
}) {
  const queryClient = useQueryClient();
  const sectionButtonRefs = useRef<Record<SettingsSection, HTMLButtonElement | null>>({
    general: null,
    runtime: null,
    shell: null,
    keyring: null,
    updates: null,
    advanced: null,
  });
  const { updateSettingsMutation, checkForUpdatesMutation, installUpdateMutation, mutationLock } =
    useDesktopActions();
  const [runtimeKind, setRuntimeKind] = useState(settings.runtime_kind);
  const [runtimePath, setRuntimePath] = useState(settings.runtime_path ?? "");
  const [showAdvancedRuntime, setShowAdvancedRuntime] = useState(
    settings.runtime_kind !== "bundled",
  );
  const [aiswHome, setAiswHome] = useState(settings.aisw_home ?? "");
  const [updateChannel, setUpdateChannel] = useState(settings.update_channel);
  const readEnabled = useMutationAwareQueryEnabled();
  const shellGuidance = useQuery({
    queryKey: ["shell-guidance"],
    queryFn: getShellGuidance,
    enabled: readEnabled,
  });
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor, enabled: readEnabled });
  const launchAtLogin = useQuery({
    queryKey: ["launch-at-login"],
    queryFn: getLaunchAtLoginStatus,
    enabled: readEnabled,
  });
  const [selectedShell, setSelectedShell] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [advancedMessage, setAdvancedMessage] = useState("");
  const [launchMessage, setLaunchMessage] = useState("");
  const [appearance, setAppearance] = useState<DesktopPreferences["appearance"]>(
    desktopPreferences?.appearance ?? "system",
  );
  const [defaultSection, setDefaultSection] = useState<DesktopPreferences["defaultSection"]>(
    desktopPreferences?.defaultSection ?? "overview",
  );
  const [showMenuBarIcon, setShowMenuBarIcon] = useState(
    desktopPreferences?.showMenuBarIcon ?? true,
  );
  const [generalMessage, setGeneralMessage] = useState("");
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(
    initialSection ?? "general",
  );

  const shellCheck = useMemo(() => findShellHookCheck(doctor.data), [doctor.data]);
  const launchAtLoginMutation = useMutation({
    mutationFn: setLaunchAtLogin,
    onSuccess: (status) => {
      queryClient.setQueryData(["launch-at-login"], status);
      setLaunchMessage(status.enabled ? "Launch at login enabled." : "Launch at login disabled.");
    },
    onError: (error) => {
      setLaunchMessage(error instanceof Error ? error.message : "AI Switch could not update launch at login.");
    },
  });
  const selectedVariant = useMemo(() => {
    const variants = shellGuidance.data?.variants ?? [];
    if (!variants.length) return undefined;
    return variants.find((variant) => variant.shell === selectedShell) ?? variants[0];
  }, [selectedShell, shellGuidance.data]);
  const hasPendingSettingsChanges =
    runtimeKind !== settings.runtime_kind ||
    effectiveRuntimePath(runtimeKind, runtimePath) !== (settings.runtime_path ?? "") ||
    aiswHome !== (settings.aisw_home ?? "") ||
    updateChannel !== settings.update_channel;

  useEffect(() => {
    if (!shellGuidance.data?.variants.length) return;
    const preferred = shellGuidance.data.detected_shell;
    const next = shellGuidance.data.variants.find((variant) => variant.shell === preferred)?.shell
      ?? shellGuidance.data.variants[0].shell;
    setSelectedShell((current) => current || next);
  }, [shellGuidance.data]);

  useEffect(() => {
    setRuntimeKind(settings.runtime_kind);
    setRuntimePath(settings.runtime_path ?? "");
    setShowAdvancedRuntime(settings.runtime_kind !== "bundled");
    setAiswHome(settings.aisw_home ?? "");
    setUpdateChannel(settings.update_channel);
  }, [
    settings.runtime_kind,
    settings.runtime_path,
    settings.aisw_home,
    settings.update_channel,
  ]);

  useEffect(() => {
    if (checkForUpdatesMutation.isPending || installUpdateMutation.isPending) {
      return;
    }
    checkForUpdatesMutation.reset();
    installUpdateMutation.reset();
  }, [
    hasPendingSettingsChanges,
    settings.runtime_kind,
    settings.runtime_path,
    settings.aisw_home,
    settings.update_channel,
  ]);

  useEffect(() => {
    setSelectedSection(initialSection ?? "general");
  }, [initialSection]);

  useEffect(() => {
    setAppearance(desktopPreferences?.appearance ?? "system");
    setDefaultSection(desktopPreferences?.defaultSection ?? "overview");
    setShowMenuBarIcon(desktopPreferences?.showMenuBarIcon ?? true);
    setGeneralMessage("");
    setLaunchMessage("");
  }, [desktopPreferences]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSettingsMutation.mutate({
      runtime_kind: runtimeKind,
      runtime_path: effectiveRuntimePath(runtimeKind, runtimePath) || null,
      aisw_home: aiswHome || null,
      update_channel: updateChannel,
      profile_labels: settings.profile_labels ?? {},
      profile_sets: settings.profile_sets,
    });
  }

  async function copyText(value: string, label: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(`Clipboard access is unavailable. Copy the ${label} step manually.`);
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopyMessage(`Copied ${label} step.`);
  }

  async function exportReport() {
    setSecurityMessage("");
    try {
      const result = await exportDiagnosticBundle();
      const message = `Saved ${result.filename}.`;
      setSecurityMessage(message);
      void notifyDesktop({
        title: "Diagnostic report exported",
        body: message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI Switch could not complete that action.";
      setSecurityMessage(message);
      void notifyDesktop({
        title: "Diagnostic export failed",
        body: message,
      });
    }
  }

  async function revealAppDataFolder() {
    setAdvancedMessage("");
    try {
      const path = await openAppDataFolder();
      setAdvancedMessage(`Opened ${path}.`);
      void notifyDesktop({
        title: "App data folder opened",
        body: path,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI Switch could not open the app data folder.";
      setAdvancedMessage(message);
    }
  }

  function resetOnboarding() {
    const nextPreferences: DesktopPreferences = {
      appearance,
      defaultSection: DEFAULT_DESKTOP_PREFERENCES.defaultSection,
      showMenuBarIcon,
      reopenSetupAssistant: true,
    };
    onUpdateDesktopPreferences?.(nextPreferences);
    onResetOnboarding?.();
    setSelectedSection("general");
    setGeneralMessage("Onboarding reset. AI Switch will reopen the setup assistant.");
  }

  function focusSection(section: SettingsSection) {
    window.requestAnimationFrame(() => {
      sectionButtonRefs.current[section]?.focus();
    });
  }

  function moveSectionSelection(
    currentSection: SettingsSection,
    direction: "next" | "previous" | "first" | "last",
  ) {
    const currentIndex = SETTINGS_SECTIONS.indexOf(currentSection);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex =
      direction === "first"
        ? 0
        : direction === "last"
          ? SETTINGS_SECTIONS.length - 1
          : direction === "next"
            ? Math.min(currentIndex + 1, SETTINGS_SECTIONS.length - 1)
            : Math.max(currentIndex - 1, 0);
    const targetSection = SETTINGS_SECTIONS[targetIndex];
    if (!targetSection || targetSection === currentSection) {
      return;
    }

    setSelectedSection(targetSection);
    focusSection(targetSection);
  }

  function handleSectionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    section: SettingsSection,
  ) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveSectionSelection(section, "next");
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveSectionSelection(section, "previous");
        break;
      case "Home":
        event.preventDefault();
        moveSectionSelection(section, "first");
        break;
      case "End":
        event.preventDefault();
        moveSectionSelection(section, "last");
        break;
      default:
        break;
    }
  }

  function saveGeneralPreferences() {
    onUpdateDesktopPreferences?.({
      appearance,
      defaultSection,
      showMenuBarIcon,
      reopenSetupAssistant: desktopPreferences?.reopenSetupAssistant ?? false,
    });
    setGeneralMessage("General preferences saved.");
  }

  const launchAtLoginSupported = launchAtLogin.data?.supported ?? false;
  const launchAtLoginEnabled = launchAtLogin.data?.enabled ?? false;
  const launchAtLoginDetail = launchAtLogin.data?.detail;

  return (
    <SectionCard title="Settings" kicker={sectionKicker(selectedSection)}>
      <SplitView
        className="settings-split"
        primaryClassName="settings-nav-pane"
        secondaryClassName="settings-detail-pane"
        primary={
          <div className="stack-list">
            <SourceListPanel
              className="settings-nav-card"
              kicker="Desktop Preferences"
              title="Settings"
              listLabel="Settings sections"
              badge={<span className="pill pill-soft">{sectionLabel(selectedSection)}</span>}
              note="Choose a section once, make the change, and return to coding without hunting through a dashboard."
              meta={
                <div className="settings-nav-meta">
                  <div>
                    <span className="overview-current-set-cell-label">Current section</span>
                    <strong>{sectionHeading(selectedSection)}</strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Why it exists</span>
                    <strong>{sourceListSummary(selectedSection)}</strong>
                  </div>
                  <div className="settings-nav-pill-row">
                    {sectionPills(selectedSection).map((pill) => (
                      <span key={pill} className="status-pill">
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
              }
            >
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section}
                  ref={(node) => {
                    sectionButtonRefs.current[section] = node;
                  }}
                  type="button"
                  aria-label={sectionLabel(section)}
                  aria-describedby={`settings-section-summary-${section}`}
                  aria-pressed={selectedSection === section}
                  className={`desktop-source-row ${
                    selectedSection === section ? "desktop-source-row-selected" : ""
                  }`}
                  onClick={() => setSelectedSection(section)}
                  onKeyDown={(event) => handleSectionKeyDown(event, section)}
                >
                  <div className="settings-nav-row-copy">
                    <strong>{sectionLabel(section)}</strong>
                    <p
                      id={`settings-section-summary-${section}`}
                      className="inline-note"
                    >
                      {sourceListSummary(section)}
                    </p>
                  </div>
                  <div className="settings-nav-row-meta">
                    <span className="status-pill status-pill-subtle">{sectionShortTag(section)}</span>
                    <span className="desktop-source-chevron" aria-hidden="true">
                      ›
                    </span>
                  </div>
                </button>
              ))}
            </SourceListPanel>
          </div>
        }
        secondary={
      <div className="settings-pane">
        <div className="settings-status-strip">
          <article className="settings-status-card">
            <span className="overview-current-set-cell-label">Section</span>
            <p className="settings-status-value">{sectionHeading(selectedSection)}</p>
            <p className="inline-note">{sectionDescription(selectedSection)}</p>
          </article>
          {sectionFacts(selectedSection).map((fact) => (
            <article key={fact.label} className="settings-status-card">
              <span className="overview-current-set-cell-label">{fact.label}</span>
              <p className="settings-status-value">{fact.value}</p>
              <div className="settings-status-pill-stack">
                <span className="pill pill-soft">{sectionLabel(selectedSection)}</span>
              </div>
            </article>
          ))}
        </div>
        {selectedSection === "general" ? (
          <div className="settings-workspace">
            <article className="diagnostic-card settings-overview-card">
              <div className="settings-overview-copy">
                <div>
                  <p className="card-kicker">General</p>
                  <h3>Desktop defaults</h3>
                  <p className="inline-note">
                    Keep the app aligned with the operating system, choose the launch destination, and decide whether the menu bar utility stays available for quick switching.
                  </p>
                </div>
                <span className="pill pill-soft">Recommended</span>
              </div>
              <div className="settings-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Appearance</span>
                  <strong>{titleCase(appearance)}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Login item</span>
                  <strong>Managed by the operating system</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Menu bar extra</span>
                  <strong>{showMenuBarIcon ? "Visible" : "Hidden"}</strong>
                </div>
              </div>
            </article>
            <div className="settings-detail-grid">
              <div className="settings-main-stack">
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">General</p>
                      <h3>Desktop appearance</h3>
                    </div>
                  </div>
                  <div className="settings-inline-grid settings-inline-grid-2">
                    <label>
                      Appearance
                      <select
                        value={appearance}
                        onChange={(event) =>
                          setAppearance(event.target.value as DesktopPreferences["appearance"])
                        }
                      >
                        {DESKTOP_APPEARANCES.map((entry) => (
                          <option key={entry} value={entry}>
                            {titleCase(entry)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="settings-note-block">
                      <strong>Appearance behavior</strong>
                      <p className="inline-note">
                        System keeps the window aligned with the OS. Light and Dark pin the app to one appearance until you change it again.
                      </p>
                    </div>
                  </div>
                </article>
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Launch</p>
                      <h3>Launch behavior</h3>
                    </div>
                  </div>
                  <div className="settings-toggle-list" aria-label="Launch behavior controls">
                    <label
                      className={`settings-toggle-row ${
                        launchAtLoginSupported ? "" : "settings-toggle-row-disabled"
                      }`}
                    >
                      <span className="settings-toggle-copy">
                        <strong>Launch at login</strong>
                        <span className="inline-note">
                          {launchAtLogin.isLoading
                            ? "Checking the operating system login item state for this app."
                            : launchAtLoginSupported
                              ? "Open AI Switch automatically after you sign in to this computer."
                              : launchAtLoginDetail ??
                                "Launch at login is currently available on supported desktop builds."}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        aria-label="Launch at login"
                        checked={launchAtLoginEnabled}
                        disabled={
                          launchAtLogin.isLoading ||
                          launchAtLoginMutation.isPending ||
                          !launchAtLoginSupported
                        }
                        onChange={(event) => {
                          setLaunchMessage("");
                          launchAtLoginMutation.mutate(event.target.checked);
                        }}
                      />
                    </label>
                    <label className="settings-toggle-row">
                      <span className="settings-toggle-copy">
                        <strong>Show menu bar icon</strong>
                        <span className="inline-note">
                          Keep the AI Switch menu bar extra available for quick switching, verification, and diagnostics without opening the full app.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        aria-label="Show menu bar icon"
                        checked={showMenuBarIcon}
                        onChange={(event) => setShowMenuBarIcon(event.target.checked)}
                      />
                    </label>
                  </div>
                  {launchMessage ? <p className="inline-note">{launchMessage}</p> : null}
                </article>
              </div>
              <div className="settings-side-stack">
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Default section</p>
                      <h3>Start destination</h3>
                    </div>
                  </div>
                  <label>
                    Default section
                    <select
                      value={defaultSection}
                      onChange={(event) =>
                        setDefaultSection(event.target.value as DesktopPreferences["defaultSection"])
                      }
                    >
                      {DEFAULT_SECTIONS.map((entry) => (
                        <option key={entry} value={entry}>
                          {titleCase(entry)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="settings-note-block">
                    <p className="inline-note">
                      Runtime blockers and first-run onboarding still take priority when they need your attention.
                    </p>
                    <p className="inline-note">
                      Next launch opens on <strong>{titleCase(defaultSection)}</strong> whenever the app can resume normally.
                    </p>
                  </div>
                  <div className="button-row">
                    <button className="primary-button" type="button" onClick={saveGeneralPreferences}>
                      Save General Settings
                    </button>
                  </div>
                  {generalMessage ? <p className="inline-note">{generalMessage}</p> : null}
                </article>
                <article className="diagnostic-card diagnostic-pass settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Desktop behavior</p>
                      <h3>Focused desktop flow</h3>
                    </div>
                  </div>
                  <div className="settings-info-list">
                    <div className="settings-info-row">
                      <strong>One settings language</strong>
                      <span className="inline-note">Every section follows the same desktop interaction pattern.</span>
                    </div>
                    <div className="settings-info-row">
                      <strong>Credentials stay local.</strong>
                      <span className="inline-note">
                        No telemetry or prompt proxy is used.
                      </span>
                    </div>
                    <div className="settings-info-row">
                      <strong>Focused navigation</strong>
                      <span className="inline-note">
                        Use the source list on the left to move directly to runtime, terminal, security, updates, and storage details.
                      </span>
                    </div>
                  </div>
                  <div className="settings-guide-block">
                    <h4>Setup assistant</h4>
                    <p className="inline-note">
                      Reopen the guided setup assistant to review detection, your first shared switch,
                      and optional terminal integration from the beginning.
                    </p>
                  </div>
                  <div className="settings-note-block">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={!onReopenSetupAssistant}
                      onClick={onReopenSetupAssistant}
                    >
                      Reopen Setup Assistant
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </div>
        ) : null}

        {selectedSection === "runtime" ? (
          <div className="settings-workspace">
            <article
              className={`diagnostic-card settings-overview-card ${
                runtimeKind === "bundled" ? "diagnostic-pass" : "diagnostic-warn"
              }`}
            >
              <div className="settings-overview-copy">
                <div>
                  <p className="card-kicker">Current setup</p>
                  <h3>Runtime selection</h3>
                  <p className="inline-note">
                    This app ships with a compatible runtime and uses it by default. Use a system or custom runtime only when you intentionally need to replace the included desktop runtime.
                  </p>
                </div>
                <span className={`pill ${runtimeKind === "bundled" ? "pill-ok" : "pill-warn"}`}>
                  {runtimeKind === "bundled" ? "Included runtime" : titleCase(runtimeKind)}
                </span>
              </div>
              <div className="settings-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Compatibility</span>
                  <strong>{runtimeStatus.compatible ? "Ready" : "Needs attention"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Version</span>
                  <strong>{runtimeStatus.version?.version ?? "unknown"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Recommended</span>
                  <strong>Bundled</strong>
                </div>
              </div>
              <div className="settings-guide-block">
                <h4>Runtime summary</h4>
                <div className="settings-kv-list">
                  <div className="settings-kv-row">
                    <strong>Source</strong>
                    <strong>
                      {runtimeKind === "bundled"
                        ? "Included with this app"
                        : runtimeKind === "system"
                          ? "System runtime"
                          : "Custom runtime"}
                    </strong>
                  </div>
                  <div className="settings-kv-row">
                    <strong>Runtime mode</strong>
                    <strong>{titleCase(runtimeKind)}</strong>
                  </div>
                  <div className="settings-kv-row">
                    <strong>Runtime version</strong>
                    <strong>{runtimeStatus.version?.version ?? "unknown"}</strong>
                  </div>
                </div>
                <p className="inline-note">
                  Runtime version: {runtimeStatus.version?.version ?? "unknown"}
                </p>
              </div>
            </article>
            <div className="settings-detail-grid">
              <form className="stacked-form settings-form settings-main-stack" onSubmit={submit}>
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Runtime</p>
                      <h3>Runtime source</h3>
                    </div>
                  </div>
                  {showAdvancedRuntime ? (
                    <>
                      <label>
                        Runtime source
                        <select
                          value={runtimeKind}
                          onChange={(event) =>
                            setRuntimeKind(event.target.value as typeof runtimeKind)
                          }
                        >
                          <option value="bundled">Included runtime</option>
                          <option value="system">System runtime</option>
                          <option value="custom">Custom path</option>
                        </select>
                      </label>
                      <label>
                        Runtime path
                        <input
                          value={runtimePath}
                          disabled={runtimeKind !== "custom"}
                          placeholder={
                            runtimeKind === "custom"
                              ? "/path/to/runtime"
                              : "Only used for a custom runtime"
                          }
                          onChange={(event) => setRuntimePath(event.target.value)}
                        />
                      </label>
                      <div className="settings-note-block">
                        <p className="inline-note">
                          Keep the included runtime selected unless you intentionally need a different runtime source.
                        </p>
                        {runtimeKind === "bundled" ? (
                          <div className="button-row">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => setShowAdvancedRuntime(false)}
                            >
                              Hide manual runtime options
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="settings-note-block">
                      <p className="inline-note">
                        Keep the included runtime selected unless you intentionally need a different runtime source.
                      </p>
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setShowAdvancedRuntime(true)}
                        >
                          Show manual runtime options
                        </button>
                      </div>
                    </div>
                  )}
                </article>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? "Saving…" : "Save Runtime Settings"}
                </button>
              </form>
              <div className="settings-side-stack diagnostics-body">
                {updateSettingsMutation.error ? (
                  <MutationErrorCard
                    title="Settings could not be saved"
                    error={updateSettingsMutation.error}
                  />
                ) : null}
                {runtimeKind !== "bundled" ? (
                  <article className="diagnostic-card diagnostic-warn settings-pane-section">
                    <h3>Manual runtime source is active</h3>
                    <p className="inline-note">
                      This app session is using a {runtimeKind === "system" ? "system" : "custom"} runtime instead of the included runtime.
                    </p>
                    <p className="inline-note">
                      Compatibility for onboarding, switching, and diagnostics is only guaranteed with the included runtime shipped in this app release.
                    </p>
                  </article>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {selectedSection === "updates" ? (
          <div className="settings-workspace">
            <article className="diagnostic-card settings-overview-card">
              <div className="settings-overview-copy">
                <div>
                  <p className="card-kicker">Current setup</p>
                  <h3>Release track</h3>
                  <p className="inline-note">
                    Choose the release track for this computer. Stable is recommended for day-to-day switching. Beta is for earlier builds.
                  </p>
                </div>
                <span className="pill pill-soft">{titleCase(updateChannel)}</span>
              </div>
              <div className="settings-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Channel</span>
                  <strong>{titleCase(updateChannel)}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Runtime</span>
                  <strong>{runtimeKind === "bundled" ? "Bundled" : titleCase(runtimeKind)}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Updates</span>
                  <strong>Signed desktop releases</strong>
                </div>
              </div>
            </article>
            <div className="settings-detail-grid">
              <div className="settings-main-stack">
                <form className="stacked-form settings-form" onSubmit={submit}>
                  <article className="diagnostic-card settings-detail-card">
                    <div className="desktop-pane-section-header">
                      <div>
                        <p className="card-kicker">Signed desktop releases</p>
                        <h3>Release track</h3>
                      </div>
                    </div>
                    <label>
                      Update channel
                      <select
                        value={updateChannel}
                        onChange={(event) => setUpdateChannel(event.target.value)}
                      >
                        <option value="stable">Stable</option>
                        <option value="beta">Beta</option>
                      </select>
                    </label>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                    >
                      {updateSettingsMutation.isPending ? "Saving…" : "Save Update Settings"}
                    </button>
                  </article>
                </form>
                {updateSettingsMutation.error ? (
                  <MutationErrorCard
                    title="Settings could not be saved"
                    error={updateSettingsMutation.error}
                  />
                ) : null}
              </div>
              <div className="settings-side-stack">
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Check</p>
                      <h3>Available releases</h3>
                    </div>
                  </div>
                  <p className="inline-note">
                    Check for a signed desktop release on the selected {updateChannel} channel.
                  </p>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={
                        mutationLock.isBusy ||
                        checkForUpdatesMutation.isPending ||
                        hasPendingSettingsChanges
                      }
                      onClick={() => checkForUpdatesMutation.mutate()}
                    >
                      {checkForUpdatesMutation.isPending ? "Checking…" : "Check for Updates"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        mutationLock.isBusy ||
                        hasPendingSettingsChanges ||
                        installUpdateMutation.isPending ||
                        !checkForUpdatesMutation.data?.update
                      }
                      onClick={() => installUpdateMutation.mutate()}
                    >
                      {installUpdateMutation.isPending ? "Installing…" : "Install Update"}
                    </button>
                  </div>
                  {hasPendingSettingsChanges ? (
                    <p className="inline-note">
                      Save settings before checking for updates so the runtime and channel selection match
                      the persisted desktop configuration.
                    </p>
                  ) : null}
                  {checkForUpdatesMutation.data ? (
                    <div className="settings-info-list">
                      <p className="inline-note">
                        Current app version: {checkForUpdatesMutation.data.current_version}
                      </p>
                      <p className="inline-note">Channel: {checkForUpdatesMutation.data.channel}</p>
                      {checkForUpdatesMutation.data.endpoint ? (
                        <p className="inline-note">Endpoint: {checkForUpdatesMutation.data.endpoint}</p>
                      ) : null}
                      {checkForUpdatesMutation.data.update ? (
                        <>
                          <p className="inline-note">
                            Update available: {checkForUpdatesMutation.data.update.version}
                          </p>
                          {checkForUpdatesMutation.data.update.notes ? (
                            <p className="inline-note">{checkForUpdatesMutation.data.update.notes}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="inline-note">
                          {checkForUpdatesMutation.data.message ?? "No update is currently available."}
                        </p>
                      )}
                    </div>
                  ) : null}
                </article>
                {checkForUpdatesMutation.error ? (
                  <MutationErrorCard title="Update check failed" error={checkForUpdatesMutation.error} />
                ) : null}
                {installUpdateMutation.data ? (
                  <article className="diagnostic-card diagnostic-pass">
                    <h3>Install status</h3>
                    <p className="inline-note">
                      {installUpdateMutation.data.message ??
                        (installUpdateMutation.data.installed_version
                          ? `Installed ${installUpdateMutation.data.installed_version}`
                          : "No update installed.")}
                    </p>
                  </article>
                ) : null}
                {installUpdateMutation.error ? (
                  <MutationErrorCard title="Update install failed" error={installUpdateMutation.error} />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {selectedSection === "shell" ? (
          <div className="settings-workspace">
            <article className="diagnostic-card settings-overview-card">
              <div className="settings-overview-copy">
                <div>
                  <p className="card-kicker">Terminal</p>
                  <h3>Terminal integration</h3>
                  <p className="inline-note">
                    Leave terminal integration off unless you want already-open terminal windows to react immediately after a switch.
                  </p>
                </div>
                <span
                  className={`pill ${
                    shellCheck?.status === "pass"
                      ? "pill-ok"
                      : shellCheck?.status === "warn"
                        ? "pill-warn"
                        : "pill-soft"
                  }`}
                >
                  {shellCheck?.status === "pass"
                    ? "Active"
                    : shellCheck?.status === "warn"
                      ? "Optional"
                      : "Unknown"}
                </span>
              </div>
              <div className="settings-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Detected shell</span>
                  <strong>
                    {shellGuidance.data?.detected_shell
                      ? titleCase(shellGuidance.data.detected_shell)
                      : "Unknown"}
                  </strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Session state</span>
                  <strong>{shellCheck ? titleCase(shellCheck.status) : "Unknown"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Recommended</span>
                  <strong>Only when needed</strong>
                </div>
              </div>
            </article>
            <div className="settings-detail-grid">
              <div className="settings-main-stack">
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Terminal integration</p>
                      <h3>Terminal Integration</h3>
                    </div>
                  </div>
                  {shellCheck ? (
                    <p className={`diagnostic-status diagnostic-status-${shellCheck.status}`}>
                      {shellCheck.status === "pass" ? "✓" : shellCheck.status === "warn" ? "!" : "✕"}{" "}
                      Terminal integration {shellCheck.status}
                      {shellCheck.detail ? ` · ${shellCheck.detail}` : ""}
                    </p>
                  ) : (
                    <p className="inline-note">
                      Run diagnostics to verify whether terminal integration is active.
                    </p>
                  )}
                  <div className="settings-kv-list">
                    <div className="settings-kv-row">
                      <strong>Current terminal session</strong>
                      <strong>
                        {shellGuidance.data?.detected_shell
                          ? titleCase(shellGuidance.data.detected_shell)
                          : "Unknown"}
                      </strong>
                    </div>
                    <div className="settings-kv-row">
                      <strong>Recommended mode</strong>
                      <strong>Only when needed</strong>
                    </div>
                  </div>
                  <div className="settings-note-block">
                    <p className="inline-note">
                      Detected shell:{" "}
                      <strong>
                        {shellGuidance.data?.detected_shell
                          ? titleCase(shellGuidance.data.detected_shell)
                          : "Unknown"}
                      </strong>
                    </p>
                    <strong>What changes when this is off</strong>
                    <p className="inline-note">
                      Saved profiles and live credential files still update normally.
                    </p>
                    <p className="inline-note">
                      Turn this on only when already-open terminal windows should refresh immediately.
                    </p>
                  </div>
                  {shellGuidance.data ? (
                    <>
                      <div className="settings-info-list">
                        {shellGuidance.data.capabilities.map((item) => (
                          <div key={item} className="settings-info-row">
                            <span className="inline-note">{item}</span>
                          </div>
                        ))}
                      </div>
                      <label>
                        Guidance for shell
                        <select
                          value={selectedVariant?.shell ?? ""}
                          onChange={(event) => setSelectedShell(event.target.value)}
                        >
                          {shellGuidance.data.variants.map((variant) => (
                            <option key={variant.shell} value={variant.shell}>
                              {variant.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <p className="inline-note">
                      {shellGuidance.isLoading
                        ? "Loading shell guidance…"
                        : "Shell guidance is unavailable."}
                    </p>
                  )}
                </article>
              </div>
              <div className="settings-side-stack">
                {selectedVariant ? (
                  <article className="diagnostic-card settings-detail-card">
                    <div className="desktop-pane-section-header">
                      <div>
                        <p className="card-kicker">Guided setup</p>
                        <h3>Install for {selectedVariant.title}</h3>
                      </div>
                    </div>
                    <div className="settings-note-block">
                      <p className="inline-note">Config file: {selectedVariant.config_path}</p>
                      {selectedVariant.alternate_config_path ? (
                        <p className="inline-note">
                          Alternative: {selectedVariant.alternate_config_path}
                        </p>
                      ) : null}
                      <p className="inline-note">
                        The desktop app keeps terminal setup optional. Use the guided copy actions below when you want already-open shells to refresh immediately after a switch.
                      </p>
                    </div>
                    <div className="settings-steps-list">
                      <div className="settings-step-card">
                        <p className="inline-note">1. Add the AI Switch line to your shell config.</p>
                        <div className="button-row">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void copyText(selectedVariant.install_command, "setup")}
                          >
                            Copy install command
                          </button>
                        </div>
                      </div>
                      <div className="settings-step-card">
                        <p className="inline-note">2. Reload the shell config.</p>
                        <p className="inline-note">You can also open a new terminal if that is easier.</p>
                        <div className="button-row">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void copyText(selectedVariant.reload_command, "reload")}
                          >
                            Copy reload command
                          </button>
                        </div>
                      </div>
                      <div className="settings-step-card">
                        <p className="inline-note">3. Verify that terminal integration is active.</p>
                        <p className="inline-note">Expected output: {selectedVariant.verify_expected}</p>
                        <div className="button-row">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void copyText(selectedVariant.verify_command, "verify")}
                          >
                            Copy verification command
                          </button>
                        </div>
                      </div>
                    </div>
                    <details className="settings-guide-block">
                      <summary>Show advanced terminal commands</summary>
                      <div className="stack-list">
                        <p className="inline-note">
                          Most people can skip these raw commands unless they manage shell files manually.
                        </p>
                        <p className="inline-note">
                          These are the exact low-level commands behind AI Switch terminal integration.
                        </p>
                        <div>
                          <p className="inline-note">Install command</p>
                          <pre>{selectedVariant.install_command}</pre>
                        </div>
                        <div>
                          <p className="inline-note">Reload command</p>
                          <pre>{selectedVariant.reload_command}</pre>
                        </div>
                        <div>
                          <p className="inline-note">Verify command</p>
                          <pre>{selectedVariant.verify_command}</pre>
                        </div>
                      </div>
                    </details>
                  </article>
                ) : null}
                {shellGuidance.data ? (
                  <article className="diagnostic-card settings-pane-section">
                    <h3>Manual switching still works</h3>
                    <p className="inline-note">{shellGuidance.data.note}</p>
                    <p className="inline-note">
                      If you intentionally switch from Terminal instead of the desktop app, use the advanced examples below.
                    </p>
                    {shellGuidance.data.manual_apply_examples.length ? (
                      <details className="settings-guide-block">
                        <summary>Show advanced terminal examples</summary>
                        <div className="stack-list">
                          <p className="inline-note">
                            These examples are only for people who intentionally apply AI Switch commands from a terminal.
                          </p>
                          {shellGuidance.data.manual_apply_examples.map((example) => (
                            <pre key={example}>{example}</pre>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </article>
                ) : null}
                {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {selectedSection === "keyring" ? (
          <div className="settings-workspace">
            <article className="diagnostic-card settings-overview-card diagnostic-pass">
              <div className="settings-overview-copy">
                <div>
                  <p className="card-kicker">Security</p>
                  <h3>Local credential model</h3>
                  <p className="inline-note">
                    Credentials stay on this machine, storage stays local-first, and support exports are redacted before sharing.
                  </p>
                </div>
                <span className="pill pill-ok">On this computer</span>
              </div>
              <div className="settings-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Storage</span>
                  <strong>Native keyrings first</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Network</span>
                  <strong>No proxy</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Support</span>
                  <strong>Redacted bundles</strong>
                </div>
              </div>
            </article>
            <div className="settings-detail-grid">
              <div className="settings-main-stack">
                <article className="diagnostic-card diagnostic-pass settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Security</p>
                      <h3>Security</h3>
                    </div>
                  </div>
                  <div className="settings-info-list">
                    <div className="settings-info-row">
                      <strong>Credentials stay local to this computer or workstation.</strong>
                      <span className="inline-note">
                        No telemetry or remote credential proxy is used for switching.
                      </span>
                    </div>
                    <div className="settings-info-row">
                      <strong>Native keyrings remain preferred</strong>
                      <span className="inline-note">
                        The app uses operating-system storage whenever the OS provides it.
                      </span>
                    </div>
                  </div>
                </article>
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Diagnostics</p>
                      <h3>Redacted diagnostic export</h3>
                    </div>
                  </div>
                  <p className="inline-note">
                    Export a redacted bundle before sharing troubleshooting details or filing a support request.
                  </p>
                  <div className="button-row">
                    <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                      Export Redacted Diagnostic Report
                    </button>
                  </div>
                  {securityMessage ? <p className="inline-note">{securityMessage}</p> : null}
                </article>
              </div>
              <div className="settings-side-stack">
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Recovery</p>
                      <h3>OS recovery guides</h3>
                    </div>
                  </div>
                  <p className="inline-note">
                    If diagnostics report a keyring failure, use the matching OS steps below.
                  </p>
                  {KEYRING_GUIDES.map((guide) => (
                    <div key={guide.platform} className="settings-guide-block">
                      <h4>{guide.title}</h4>
                      <p className="inline-note">Expected backend: {guide.backend}</p>
                      {guide.steps.map((step) => (
                        <p key={step} className="inline-note">
                          {step}
                        </p>
                      ))}
                      <p className="inline-note">Verify: {guide.verify}</p>
                    </div>
                  ))}
                </article>
              </div>
            </div>
          </div>
        ) : null}

        {selectedSection === "advanced" ? (
          <div className="settings-workspace">
            <article className="diagnostic-card settings-overview-card">
              <div className="settings-overview-copy">
                <div>
                  <p className="card-kicker">Advanced</p>
                  <h3>Storage and paths</h3>
                  <p className="inline-note">
                    Keep custom data locations and runtime details in one place so the default settings stay simple.
                  </p>
                </div>
                <span className="pill pill-soft">{aiswHome ? "Custom" : "Managed"}</span>
              </div>
              <div className="settings-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Data folder</span>
                  <strong>{aiswHome ? "Custom location" : "Managed automatically"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Runtime source</span>
                  <strong>{runtimeKind === "bundled" ? "Included" : titleCase(runtimeKind)}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Release track</span>
                  <strong>{titleCase(updateChannel)}</strong>
                </div>
              </div>
            </article>
            <div className="settings-detail-grid">
              <form className="stacked-form settings-form settings-main-stack" onSubmit={submit}>
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Storage &amp; paths</p>
                      <h3>App data folder</h3>
                    </div>
                  </div>
                  <p className="inline-note">
                    Leave this empty to use the managed app data location.
                  </p>
                  <label>
                    Custom data folder
                    <input value={aiswHome} onChange={(event) => setAiswHome(event.target.value)} />
                  </label>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? "Saving…" : "Save Storage Settings"}
                  </button>
                  <div className="button-row">
                    <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                      Open App Data Folder
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={resetOnboarding}
                    >
                      Reset Onboarding
                    </button>
                  </div>
                  {advancedMessage ? <p className="inline-note">{advancedMessage}</p> : null}
                  {generalMessage ? <p className="inline-note">{generalMessage}</p> : null}
                </article>
              </form>
              <div className="settings-side-stack">
                {updateSettingsMutation.error ? (
                  <MutationErrorCard
                    title="Settings could not be saved"
                    error={updateSettingsMutation.error}
                  />
                ) : null}
                <article className="diagnostic-card settings-detail-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Status</p>
                      <h3>Runtime details</h3>
                    </div>
                  </div>
                  <div className="settings-kv-list">
                    <div className="settings-kv-row">
                      <strong>Data folder</strong>
                      <strong>
                        {settings.aisw_home
                          ? `Custom data folder (${settings.aisw_home})`
                          : "Managed automatically"}
                      </strong>
                    </div>
                    <div className="settings-kv-row">
                      <strong>Release track</strong>
                      <strong>{titleCase(updateChannel)}</strong>
                    </div>
                    <div className="settings-kv-row">
                      <strong>Selected runtime source</strong>
                      <strong>
                        {runtimeKind === "bundled"
                          ? "Included with this app"
                          : runtimeKind === "system"
                            ? "System override"
                            : "Custom override"}
                      </strong>
                    </div>
                    <div className="settings-kv-row">
                      <strong>Included runtime</strong>
                      <strong>
                        {runtimeStatus.inventory.bundled_path
                          ? "Available in this build"
                          : "Not included in this build"}
                      </strong>
                    </div>
                    <div className="settings-kv-row">
                      <strong>System runtime</strong>
                      <strong>{runtimeStatus.inventory.system_path ? "Found on this computer" : "Not found"}</strong>
                    </div>
                  </div>
                  <p className="inline-note">
                    Data folder:{" "}
                    {settings.aisw_home ? `Custom data folder (${settings.aisw_home})` : "Managed automatically"}
                  </p>
                  <p className="inline-note">
                    Release track: <strong>{titleCase(updateChannel)}</strong>
                  </p>
                  {runtimeStatus.version ? (
                    <p className="inline-note">
                      Runtime API {runtimeStatus.version.cli_api_version} · JSON schema{" "}
                      {runtimeStatus.version.json_schema_version} · Progress schema{" "}
                      {runtimeStatus.version.progress_schema_version}
                    </p>
                  ) : null}
                  <p className="inline-note">
                    Selected runtime source:{" "}
                    <strong>
                      {runtimeKind === "bundled"
                        ? "Included with this app"
                        : runtimeKind === "system"
                          ? "System override"
                          : "Custom override"}
                    </strong>
                  </p>
                  <p className="inline-note">
                    Included runtime:{" "}
                    <strong>
                      {runtimeStatus.inventory.bundled_path
                        ? "Available in this build"
                        : "Not included in this build"}
                    </strong>
                  </p>
                  <p className="inline-note">
                    System runtime:{" "}
                    <strong>{runtimeStatus.inventory.system_path ? "Found on this computer" : "Not found"}</strong>
                  </p>
                  {runtimeStatus.inventory.configured_path ? (
                    <p className="inline-note">A custom runtime path is configured.</p>
                  ) : null}
                </article>
              </div>
            </div>
          </div>
        ) : null}
      </div>
        }
      />
    </SectionCard>
  );
}

const KEYRING_GUIDES = [
  {
    platform: "macos",
    title: "macOS Keychain",
    backend: "Login keychain",
    steps: [
      "Open Keychain Access and confirm the login keychain is unlocked.",
      "Approve any keychain access prompts for AI Switch, Claude, Codex, or Gemini.",
      "If access keeps failing, lock and unlock the login keychain, then rerun diagnostics.",
    ],
    verify: "Rerun diagnostics and confirm the keyring warning disappears.",
  },
  {
    platform: "windows",
    title: "Windows Credential Manager",
    backend: "Credential Manager / DPAPI",
    steps: [
      "Stay signed in to a normal desktop session before launching AI Switch.",
      "Confirm security software is not blocking local credential storage prompts.",
      "If the machine policy reset credentials, sign in again and retry the profile action.",
    ],
    verify: "Retry the failed profile action and confirm no keyring warning returns.",
  },
  {
    platform: "linux",
    title: "Linux Secret Service",
    backend: "Secret Service daemon",
    steps: [
      "Start a Secret Service provider such as gnome-keyring or KeePassXC with Secret Service enabled.",
      "Make sure the desktop session has an active D-Bus user session before launching AI Switch.",
      "If diagnostics still fail, unlock the keyring collection or restart the secret service daemon.",
    ],
    verify: "Run diagnostics again after the secret service is available.",
  },
] as const;

function MutationErrorCard({ title, error }: { title: string; error: unknown }) {
  const resolved = formatMutationError(error);

  return (
    <article className="diagnostic-card diagnostic-fail">
      <h3>{title}</h3>
      <p className="inline-note">{resolved.message}</p>
      {resolved.remediation ? <p className="inline-note">{resolved.remediation}</p> : null}
    </article>
  );
}

function formatMutationError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return {
      message: normalizeRuntimeLanguage(error.message),
      remediation: normalizeRuntimeLanguage(error.remediation),
    };
  }
  if (error instanceof Error) {
    return {
      message: normalizeRuntimeLanguage(error.message),
      remediation: undefined,
    };
  }
  return {
    message: "AI Switch could not complete that action.",
    remediation: undefined,
  };
}

function findShellHookCheck(report: Record<string, unknown> | undefined) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  for (const entry of checks) {
    const check = entry as { name?: string; status?: string; detail?: string };
    if (!check.name?.toLowerCase().includes("shell")) continue;
    return {
      status:
        check.status === "pass" || check.status === "warn" || check.status === "fail"
          ? check.status
          : "warn",
      detail: normalizeTerminalIntegrationText(check.detail ?? ""),
    };
  }
  return null;
}

function effectiveRuntimePath(runtimeKind: DesktopSettings["runtime_kind"], runtimePath: string) {
  if (runtimeKind !== "custom") {
    return "";
  }
  return runtimePath;
}

function sectionLabel(section: SettingsSection) {
  switch (section) {
    case "general":
      return "General";
    case "runtime":
      return "Runtime";
    case "updates":
      return "Updates";
    case "shell":
      return "Terminal Integration";
    case "keyring":
      return "Security";
    case "advanced":
      return "Advanced";
  }
}

function sectionKicker(section: SettingsSection) {
  switch (section) {
    case "general":
      return "Appearance, launch, and startup";
    case "runtime":
      return "Included runtime and overrides";
    case "updates":
      return "App updates";
    case "shell":
      return "Terminal setup and current-session switching";
    case "keyring":
      return "Local credential storage";
    case "advanced":
      return "Advanced paths and app data";
  }
}

function sectionHeading(section: SettingsSection) {
  switch (section) {
    case "general":
      return "Keep AI Switch aligned with your desktop";
    case "runtime":
      return "Choose which AI Switch runtime this app should use";
    case "updates":
      return "Manage signed desktop releases in one place";
    case "shell":
      return "Set up terminal integration only when you need it";
    case "keyring":
      return "Keep credentials local with native OS storage";
    case "advanced":
      return "Keep advanced paths and reset tools out of the main settings flow";
  }
}

function sectionDescription(section: SettingsSection) {
  switch (section) {
    case "general":
      return "General settings should stay short, obvious, and system-driven so the app feels like a native desktop utility.";
    case "runtime":
      return "The included runtime is the supported default. System and custom overrides stay available for advanced cases.";
    case "updates":
      return "Choose the release track for this computer, then check and install signed desktop updates without leaving the app.";
    case "shell":
      return "Terminal integration follows one guided copy-and-verify flow across supported shells so it stays approachable for non-terminal users.";
    case "keyring":
      return "Security guidance, storage behavior, and recovery steps should stay clear without exposing unnecessary implementation detail.";
    case "advanced":
      return "Advanced storage, reset, and path details stay available for recovery and debugging without dominating the default AI Switch settings experience.";
  }
}

function sectionPills(section: SettingsSection) {
  switch (section) {
    case "general":
      return ["System-driven", "Native defaults", "Local control"];
    case "runtime":
      return ["Included default", "Cross-platform", "Advanced override"];
    case "updates":
      return ["Signed releases", "Stable or beta", "In-app install"];
    case "shell":
      return ["Optional setup", "Shell-aware", "Copy and verify"];
    case "keyring":
      return ["Credentials stay local", "Native storage", "Recovery guides"];
    case "advanced":
      return ["Custom paths", "App data", "Runtime inventory"];
  }
}

function sourceListSummary(section: SettingsSection) {
  switch (section) {
    case "general":
      return "Appearance and startup";
    case "runtime":
      return "Included runtime and overrides";
    case "updates":
      return "Release channel and signed installs";
    case "shell":
      return "Terminal integration guidance";
    case "keyring":
      return "Credential storage and recovery";
    case "advanced":
      return "App data, reset, and paths";
  }
}

function sectionShortTag(section: SettingsSection) {
  switch (section) {
    case "general":
      return "UI";
    case "runtime":
      return "Core";
    case "updates":
      return "Update";
    case "shell":
      return "Shell";
    case "keyring":
      return "Local";
    case "advanced":
      return "Paths";
  }
}

function sectionFacts(section: SettingsSection) {
  switch (section) {
    case "general":
      return [
        { label: "Scope", value: "Appearance and launch" },
        { label: "Default", value: "System-first" },
        { label: "Best for", value: "Daily use" },
      ];
    case "runtime":
      return [
        { label: "Default", value: "Included runtime" },
        { label: "Overrides", value: "System or custom" },
        { label: "Risk", value: "Compatibility drift" },
      ];
    case "updates":
      return [
        { label: "Source", value: "Signed desktop releases" },
        { label: "Tracks", value: "Stable or beta" },
        { label: "Install", value: "In app" },
      ];
    case "shell":
      return [
        { label: "Need", value: "Optional" },
        { label: "Best for", value: "Open terminals" },
        { label: "Flow", value: "Copy and verify" },
      ];
    case "keyring":
      return [
        { label: "Storage", value: "Native first" },
        { label: "Network", value: "No proxy" },
        { label: "Support", value: "Redacted export" },
      ];
    case "advanced":
      return [
        { label: "Focus", value: "Paths and app data" },
        { label: "Default", value: "Managed automatically" },
        { label: "Use when", value: "Recovery or debugging" },
      ];
  }
}
