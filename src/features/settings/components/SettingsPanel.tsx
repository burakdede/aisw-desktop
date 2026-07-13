import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { type AppBootstrap, type DesktopSettings } from "../../../lib/schemas";
import { DesktopCommandError } from "../../../lib/tauri";
import { titleCase } from "../../../lib/utils";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../../shared/terminal-integration-language";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import packageJson from "../../../../package.json";

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
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(initialSection ?? "general");
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
  const appVersion = packageJson.version;

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
  const launchAtLoginSupported = launchAtLogin.data?.supported ?? false;
  const launchAtLoginEnabled = launchAtLogin.data?.enabled ?? false;
  const launchAtLoginDetail = launchAtLogin.data?.detail;

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

  function updateGeneralPreferences(
    next: Partial<Pick<DesktopPreferences, "appearance" | "defaultSection" | "showMenuBarIcon">>,
  ) {
    setAppearance(next.appearance ?? appearance);
    setDefaultSection(next.defaultSection ?? defaultSection);
    setShowMenuBarIcon(next.showMenuBarIcon ?? showMenuBarIcon);
    setGeneralMessage("");
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

  return (
    <div className="settings-screen screen-content">
      <div className="settings-mobile-picker">
        <label className="settings-field">
          <span className="settings-field-label">Section</span>
          <select
            aria-label="Settings section"
            value={selectedSection}
            onChange={(event) => setSelectedSection(event.target.value as SettingsSection)}
          >
            {SETTINGS_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="settings-layout-v2">
        <aside className="settings-category-pane" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section}
              ref={(node) => {
                sectionButtonRefs.current[section] = node;
              }}
              className={`settings-category-row ${selectedSection === section ? "settings-category-row-active" : ""}`}
              type="button"
              aria-pressed={selectedSection === section}
              onClick={() => setSelectedSection(section)}
              onKeyDown={(event) => handleSectionKeyDown(event, section)}
            >
              {sectionLabel(section)}
            </button>
          ))}
        </aside>

        <section className="settings-form-pane">
          <div className="settings-form-scroll">
            <header className="settings-section-header">
              <h3>{sectionHeading(selectedSection)}</h3>
            </header>

            {selectedSection === "general" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Appearance">
                  <SettingsRow label="Appearance">
                    <select
                      aria-label="Appearance"
                      value={appearance}
                      onChange={(event) =>
                        updateGeneralPreferences({
                          appearance: event.target.value as DesktopPreferences["appearance"],
                        })
                      }
                    >
                      {DESKTOP_APPEARANCES.map((entry) => (
                        <option key={entry} value={entry}>
                          {titleCase(entry)}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>
                </SettingsGroup>

                <SettingsGroup title="Startup">
                  <ToggleRow
                    label="Launch at login"
                    description={
                      launchAtLoginSupported
                        ? "Open AI Switch automatically after you sign in to this computer."
                        : launchAtLoginDetail ?? "Launch at login is not available in this environment."
                    }
                    control={
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
                    }
                  />
                  <ToggleRow
                    label="Show menu bar icon"
                    description="Keep the AI Switch menu bar extra available for quick switching and diagnostics."
                    control={
                      <input
                        type="checkbox"
                        aria-label="Show menu bar icon"
                        checked={showMenuBarIcon}
                        onChange={(event) =>
                          updateGeneralPreferences({ showMenuBarIcon: event.target.checked })
                        }
                      />
                    }
                  />
                  <SettingsRow label="Open at launch">
                    <select
                      aria-label="Default section"
                      value={defaultSection}
                      onChange={(event) =>
                        updateGeneralPreferences({
                          defaultSection: event.target.value as DesktopPreferences["defaultSection"],
                        })
                      }
                    >
                      {DEFAULT_SECTIONS.map((entry) => (
                        <option key={entry} value={entry}>
                          {titleCase(entry)}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>
                  {launchMessage ? <p className="inline-note">{launchMessage}</p> : null}
                </SettingsGroup>

                <SettingsGroup title="Setup Assistant">
                  <SettingsActionRow
                    label="Guided setup"
                    description="Reopen the guided setup assistant to review detection and first-switch onboarding."
                    action={
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={!onReopenSetupAssistant}
                        onClick={onReopenSetupAssistant}
                      >
                        Reopen Setup Assistant
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsFooter>
                  <button className="primary-button" type="button" onClick={saveGeneralPreferences}>
                    Save General Settings
                  </button>
                </SettingsFooter>
                {generalMessage ? <p className="inline-note">{generalMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "runtime" ? (
              <form className="settings-section-stack" onSubmit={submit}>
                <SettingsGroup title="AISW Runtime">
                  <SettingsStaticRow label="Bundled runtime" value={runtimeStatus.version?.version ?? "Unknown"} />
                  <SettingsStaticRow label="Selected source" value={selectedEngineSourceLabel(runtimeKind)} />
                  <SettingsStaticRow label="Current path" value={selectedRuntimePath(settings, runtimeStatus)} />
                  {showAdvancedRuntime ? (
                    <>
                      <SettingsRow label="Runtime source">
                        <select
                          aria-label="Runtime source"
                          value={runtimeKind}
                          onChange={(event) =>
                            setRuntimeKind(event.target.value as typeof runtimeKind)
                          }
                        >
                          <option value="bundled">Bundled</option>
                          <option value="system">System engine</option>
                          <option value="custom">Custom path</option>
                        </select>
                      </SettingsRow>
                      <SettingsRow label="Runtime path">
                        <input
                          aria-label="Engine path"
                          value={runtimePath}
                          disabled={runtimeKind !== "custom"}
                          placeholder={runtimeKind === "custom" ? "/path/to/aisw" : ""}
                          onChange={(event) => setRuntimePath(event.target.value)}
                        />
                      </SettingsRow>
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setShowAdvancedRuntime(false)}
                        >
                          Hide manual engine options
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="button-row">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setShowAdvancedRuntime(true)}
                      >
                        Show manual engine options
                      </button>
                    </div>
                  )}
                </SettingsGroup>

                <SettingsGroup title="AISW Data">
                  <SettingsStaticRow label="AISW home" value={settings.aisw_home ?? "~/.aisw"} />
                  <SettingsActionRow
                    label="App data folder"
                    description="Open the local application data directory in Finder."
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        Open App Data Folder
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsFooter>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? "Saving…" : "Save Engine Settings"}
                  </button>
                </SettingsFooter>
                {updateSettingsMutation.error ? (
                  <MutationErrorCard title="Settings could not be saved" error={updateSettingsMutation.error} />
                ) : null}
                {advancedMessage ? <p className="inline-note">{advancedMessage}</p> : null}
              </form>
            ) : null}

            {selectedSection === "shell" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Shell hook">
                  <SettingsStaticRow
                    label="Detected shell"
                    value={
                      shellGuidance.data?.detected_shell
                        ? titleCase(shellGuidance.data.detected_shell)
                        : "Unknown"
                    }
                  />
                  <SettingsStaticRow
                    label="Shell hook"
                    value={
                      shellCheck?.status === "pass"
                        ? "Installed"
                        : shellCheck?.status === "warn"
                          ? "Not installed"
                          : "Unknown"
                    }
                  />
                  {selectedVariant ? (
                    <>
                      <SettingsActionRow
                        label="Install or verify"
                        description={`Config file: ${selectedVariant.config_path}`}
                        action={
                          <div className="button-row">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => void copyText(selectedVariant.install_command, "setup")}
                            >
                              Copy install command
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => void copyText(selectedVariant.verify_command, "verify")}
                            >
                              Copy verification command
                            </button>
                          </div>
                        }
                      />
                      <div className="stack-list">
                        <p className="inline-note">1. Copy the AI Switch setup step.</p>
                        <pre>{selectedVariant.install_command}</pre>
                        <p className="inline-note">
                          Paste it into {selectedVariant.config_path} or the matching shell config file.
                        </p>
                        <p className="inline-note">2. Reload Terminal.</p>
                        <p className="inline-note">
                          Run the reload step or open a new terminal window.
                        </p>
                        <pre>{selectedVariant.reload_command}</pre>
                        <p className="inline-note">3. Confirm that terminal integration is active.</p>
                        <pre>{selectedVariant.verify_command}</pre>
                        <p className="inline-note">Expected output: {selectedVariant.verify_expected}</p>
                      </div>
                    </>
                  ) : (
                    <p className="inline-note">
                      {shellGuidance.isLoading
                        ? "Loading shell guidance…"
                        : "Terminal setup guidance is unavailable."}
                    </p>
                  )}
                  <p className="inline-note">
                    Current terminal sessions need the hook only when they must receive CLAUDE_CONFIG_DIR or CODEX_HOME immediately.
                  </p>
                </SettingsGroup>

                {shellGuidance.data?.capabilities.length ? (
                  <SettingsGroup title="What this changes">
                    {shellGuidance.data.capabilities.map((item) => (
                      <p key={item} className="inline-note">
                        {normalizeTerminalIntegrationText(item)}
                      </p>
                    ))}
                  </SettingsGroup>
                ) : null}

                {selectedVariant || shellGuidance.data?.manual_apply_examples.length ? (
                  <details className="settings-inline-details">
                    <summary>Show advanced terminal commands</summary>
                    <div className="stack-list">
                      {selectedVariant ? <pre>{selectedVariant.install_command}</pre> : null}
                      {selectedVariant ? <pre>{selectedVariant.reload_command}</pre> : null}
                      {selectedVariant ? <pre>{selectedVariant.verify_command}</pre> : null}
                      {(shellGuidance.data?.manual_apply_examples ?? []).map((example) => (
                        <pre key={example}>{example}</pre>
                      ))}
                    </div>
                  </details>
                ) : null}

                {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "keyring" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Credential Storage">
                  <SettingsStaticRow label="Keychain backend" value="Available" />
                  <SettingsStaticRow label="File permissions" value="Correct" />
                  <SettingsStaticRow label="Remote sync" value="Disabled" />
                  <SettingsStaticRow label="Telemetry" value="Disabled" />
                </SettingsGroup>

                <SettingsGroup title="Local Data">
                  <SettingsStaticRow label="AISW data folder" value={settings.aisw_home ?? "~/.aisw"} />
                  <SettingsActionRow
                    label="Reveal in Finder"
                    description="Open the local AI Switch data location."
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        Open App Data Folder
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title="Diagnostics">
                  <SettingsActionRow
                    label="Redacted report"
                    description="Export a redacted support bundle before sharing troubleshooting details."
                    action={
                      <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                        Export Redacted Diagnostic Report
                      </button>
                    }
                  />
                  {securityMessage ? <p className="inline-note">{securityMessage}</p> : null}
                </SettingsGroup>

                <details className="settings-inline-details">
                  <summary>Recovery guides</summary>
                  <div className="stack-list">
                    {KEYRING_GUIDES.map((guide) => (
                      <div key={guide.platform} className="settings-guide-stack">
                        <strong>{guide.title}</strong>
                        <p className="inline-note">Expected backend: {guide.backend}</p>
                        {guide.steps.map((step) => (
                          <p key={step} className="inline-note">{step}</p>
                        ))}
                        <p className="inline-note">Verify: {guide.verify}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}

            {selectedSection === "updates" ? (
              <form className="settings-section-stack" onSubmit={submit}>
                <SettingsGroup title="AISW Desktop">
                  <SettingsStaticRow label="App version" value={appVersion} />
                  <SettingsRow label="Update channel">
                    <select
                      aria-label="Update channel"
                      value={updateChannel}
                      onChange={(event) => setUpdateChannel(event.target.value)}
                    >
                      <option value="stable">Stable</option>
                      <option value="beta">Beta</option>
                    </select>
                  </SettingsRow>
                  <SettingsActionRow
                    label="Available releases"
                    description={`Check for a signed desktop release on the selected ${updateChannel} channel.`}
                    action={
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={
                            mutationLock.isBusy ||
                            checkForUpdatesMutation.isPending ||
                            hasPendingSettingsChanges
                          }
                          onClick={() => checkForUpdatesMutation.mutate()}
                        >
                          Check for Updates
                        </button>
                        <button
                          className="ghost-button"
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
                    }
                  />
                  {hasPendingSettingsChanges ? (
                    <p className="inline-note">
                      Save settings before checking for updates so the engine source and channel selection match the persisted desktop configuration.
                    </p>
                  ) : null}
                </SettingsGroup>

                <SettingsGroup title="Bundled AISW Engine">
                  <SettingsStaticRow label="Included engine" value={runtimeStatus.version?.version ?? "Unknown"} />
                  <SettingsStaticRow
                    label="Compatibility"
                    value={runtimeStatus.compatible ? "Supported" : "Needs attention"}
                  />
                  <p className="inline-note">
                    AI Switch {appVersion} includes desktop engine {runtimeStatus.version?.version ?? "Unknown"}.
                  </p>
                </SettingsGroup>

                <SettingsFooter>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? "Saving…" : "Save Update Settings"}
                  </button>
                </SettingsFooter>

                {checkForUpdatesMutation.data ? (
                  <div className="settings-result-list">
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
                {installUpdateMutation.data?.message ? (
                  <div className="settings-result-list">
                    <p className="inline-note">{installUpdateMutation.data.message}</p>
                  </div>
                ) : null}
                {updateSettingsMutation.error ? (
                  <MutationErrorCard title="Settings could not be saved" error={updateSettingsMutation.error} />
                ) : null}
                {checkForUpdatesMutation.error ? (
                  <MutationErrorCard title="Update check failed" error={checkForUpdatesMutation.error} />
                ) : null}
                {installUpdateMutation.error ? (
                  <MutationErrorCard title="Update install failed" error={installUpdateMutation.error} />
                ) : null}
              </form>
            ) : null}

            {selectedSection === "advanced" ? (
              <form className="settings-section-stack" onSubmit={submit}>
                <SettingsGroup title="Application State">
                  <SettingsActionRow
                    label="App data folder"
                    description="Open the local AI Switch Desktop data location."
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        Open App Data Folder
                      </button>
                    }
                  />
                  <SettingsActionRow
                    label="Setup state"
                    description="Reset onboarding and reopen the setup assistant from the beginning."
                    action={
                      <button className="ghost-button" type="button" onClick={resetOnboarding}>
                        Reset Onboarding
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title="Data">
                  <SettingsRow label="Custom data folder">
                    <input
                      aria-label="Custom data folder"
                      value={aiswHome}
                      onChange={(event) => setAiswHome(event.target.value)}
                    />
                  </SettingsRow>
                </SettingsGroup>

                <SettingsGroup title="Engine details">
                  <p className="inline-note">
                    Data folder: {settings.aisw_home ? settings.aisw_home : "Managed automatically"}
                  </p>
                  <p className="inline-note">Release track: {titleCase(settings.update_channel)}</p>
                  <p className="inline-note">
                    Engine API {runtimeStatus.version?.cli_api_version ?? "Unknown"} · JSON schema {runtimeStatus.version?.json_schema_version ?? "Unknown"} · Progress schema {runtimeStatus.version?.progress_schema_version ?? "Unknown"}
                  </p>
                  <p className="inline-note">
                    Selected engine source: {selectedEngineSourceLabel(settings.runtime_kind)}
                  </p>
                  <p className="inline-note">
                    Included engine: {runtimeStatus.inventory?.bundled_path ? "Available in this build" : "Unavailable in this build"}
                  </p>
                  <p className="inline-note">
                    System engine: {runtimeStatus.inventory?.system_path ? "Found on this computer" : "Not found on this computer"}
                  </p>
                </SettingsGroup>

                <SettingsFooter>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? "Saving…" : "Save Storage Settings"}
                  </button>
                </SettingsFooter>
                {advancedMessage ? <p className="inline-note">{advancedMessage}</p> : null}
                {updateSettingsMutation.error ? (
                  <MutationErrorCard title="Settings could not be saved" error={updateSettingsMutation.error} />
                ) : null}
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      <h4>{title}</h4>
      <div className="settings-group-body">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="settings-row">
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">{children}</span>
    </label>
  );
}

function SettingsStaticRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="settings-row settings-row-static">
      <span className="settings-row-label">{label}</span>
      <strong className="settings-row-value">{value}</strong>
    </div>
  );
}

function SettingsActionRow({
  label,
  description,
  action,
}: {
  label: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="settings-row settings-row-action">
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        <p className="inline-note">{description}</p>
      </div>
      <div className="settings-row-control">{action}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="settings-row settings-row-toggle">
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        <p className="inline-note">{description}</p>
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}

function SettingsFooter({ children }: { children: ReactNode }) {
  return <div className="settings-footer-row">{children}</div>;
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
      return "Engine";
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

function sectionHeading(section: SettingsSection) {
  switch (section) {
    case "general":
      return "General";
    case "runtime":
      return "Engine";
    case "shell":
      return "Terminal Integration";
    case "keyring":
      return "Security";
    case "updates":
      return "Updates";
    case "advanced":
      return "Advanced";
  }
}

function selectedRuntimePath(
  settings: DesktopSettings,
  runtimeStatus: AppBootstrap["runtime_status"],
) {
  if (settings.runtime_kind === "custom") {
    return settings.runtime_path ?? "Not set";
  }
  if (settings.runtime_kind === "system") {
    return runtimeStatus.inventory?.system_path ?? "Not found";
  }
  return runtimeStatus.inventory?.bundled_path ?? "Not found";
}

function selectedEngineSourceLabel(runtimeKind: DesktopSettings["runtime_kind"]) {
  if (runtimeKind === "bundled") {
    return "Included with this app";
  }
  if (runtimeKind === "system") {
    return "System engine";
  }
  return "Custom engine";
}
