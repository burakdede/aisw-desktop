import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  exportDiagnosticBundle,
  getLaunchAtLoginStatus,
  getShellGuidance,
  openAppDataFolder,
  runDoctor,
  setLaunchAtLogin,
} from "../../../lib/client";
import {
  type DesktopPreferences,
} from "../../../lib/desktop-preferences";
import {
  DATE_UNAVAILABLE_LABEL,
  DEFAULT_ACTION_FAILURE_MESSAGE,
  NOT_FOUND_LABEL,
} from "../../../lib/display-copy";
import { notifyDesktop } from "../../../lib/notifications";
import {
  detectedShellLabel,
  SHELL_COMPLETION_AVAILABLE_LABEL,
  shellConfigPathLabel,
  shellGuidanceFallbackLabel,
  shellHookStatusLabel,
} from "../../../lib/settings-display";
import {
  runtimeCompatibilityLabel,
  runtimeReadinessLabel,
} from "../../../lib/runtime-display";
import { type AppBootstrap, type DesktopSettings } from "../../../lib/schemas";
import { clearPersistedWindowState } from "../../../lib/window-state";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import {
  buildDesktopPreferencesUpdate,
  createDesktopPreferencesDraft,
  createSettingsDraft,
  buildResetOnboardingPreferences,
  buildSettingsRequest,
  patchDesktopPreferencesDraft,
  patchSettingsDraft,
  clipboardSuccessMessage,
  clipboardUnavailableMessage,
  DEFAULT_SETTINGS_SECTION,
  effectiveRuntimePath,
  exportedDiagnosticMessage,
  findShellHookCheck,
  formatSettingsMutationError,
  launchAtLoginDescription,
  launchAtLoginErrorMessage,
  launchAtLoginSuccessMessage,
  nextSettingsSection,
  nextRuntimeSourceSelection,
  openedAppDataFolderMessage,
  appDataFolderErrorMessage,
  resolveSelectedShell,
  resolveSelectedShellVariant,
  sectionLabel,
  selectedRuntimePath,
  SETTINGS_APPEARANCE_OPTIONS,
  SETTINGS_DEFAULT_SECTION_OPTIONS,
  SETTINGS_RUNTIME_SOURCE_OPTIONS,
  settingsSectionDirectionForKey,
  SETTINGS_SECTIONS,
  SETTINGS_UPDATE_CHANNEL_OPTIONS,
  type DesktopPreferencesDraft,
  type SettingsDraft,
  type SettingsSection,
  WINDOW_LAYOUT_RESET_MESSAGE,
} from "../settings-panel-display";
import packageJson from "../../../../package.json";

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
  const sectionButtonRefs = useRef<Record<SettingsSection, HTMLButtonElement | null>>(
    Object.fromEntries(SETTINGS_SECTIONS.map((section) => [section, null])) as Record<
      SettingsSection,
      HTMLButtonElement | null
    >,
  );
  const { updateSettingsMutation, checkForUpdatesMutation, installUpdateMutation, mutationLock } =
    useDesktopActions();
  const initialSettingsDraft = createSettingsDraft(settings);
  const initialDesktopPreferencesDraft = createDesktopPreferencesDraft(desktopPreferences);
  const [runtimeKind, setRuntimeKind] = useState(initialSettingsDraft.runtimeKind);
  const [runtimePath, setRuntimePath] = useState(initialSettingsDraft.runtimePath);
  const [aiswHome, setAiswHome] = useState(initialSettingsDraft.aiswHome);
  const [updateChannel, setUpdateChannel] = useState(initialSettingsDraft.updateChannel);
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(initialSection ?? DEFAULT_SETTINGS_SECTION);
  const [selectedShell, setSelectedShell] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [advancedMessage, setAdvancedMessage] = useState("");
  const [launchMessage, setLaunchMessage] = useState("");
  const [appearance, setAppearance] = useState<DesktopPreferences["appearance"]>(
    initialDesktopPreferencesDraft.appearance,
  );
  const [defaultSection, setDefaultSection] = useState<DesktopPreferences["defaultSection"]>(
    initialDesktopPreferencesDraft.defaultSection,
  );
  const [showMenuBarIcon, setShowMenuBarIcon] = useState(
    initialDesktopPreferencesDraft.showMenuBarIcon,
  );
  const [restoreWindowState, setRestoreWindowState] = useState(
    initialDesktopPreferencesDraft.restoreWindowState,
  );
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
  const settingsDraft = {
    runtimeKind,
    runtimePath,
    aiswHome,
    updateChannel,
  };
  const desktopPreferencesDraft = {
    appearance,
    defaultSection,
    showMenuBarIcon,
    restoreWindowState,
  };

  const shellCheck = useMemo(() => findShellHookCheck(doctor.data), [doctor.data]);
  const launchAtLoginMutation = useMutation({
    mutationFn: setLaunchAtLogin,
    onSuccess: (status) => {
      queryClient.setQueryData(["launch-at-login"], status);
      setLaunchMessage(launchAtLoginSuccessMessage(status.enabled));
    },
    onError: (error) => {
      setLaunchMessage(launchAtLoginErrorMessage(error));
    },
  });
  const selectedVariant = useMemo(
    () => resolveSelectedShellVariant(shellGuidance.data, selectedShell),
    [selectedShell, shellGuidance.data],
  );
  const launchAtLoginSupported = launchAtLogin.data?.supported ?? false;
  const launchAtLoginEnabled = launchAtLogin.data?.enabled ?? false;
  const launchAtLoginDetail = launchAtLogin.data?.detail;
  const runtimePathValue = selectedRuntimePath(
    {
      ...settings,
      runtime_kind: runtimeKind,
      runtime_path: effectiveRuntimePath(runtimeKind, runtimePath) || null,
    },
    runtimeStatus,
  );

  useEffect(() => {
    const next = resolveSelectedShell(shellGuidance.data, selectedShell);
    if (!next || next === selectedShell) {
      return;
    }
    setSelectedShell(next);
  }, [selectedShell, shellGuidance.data]);

  useEffect(() => {
    applySettingsDraft(createSettingsDraft(settings));
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
    runtimeKind,
    runtimePath,
    aiswHome,
    updateChannel,
    settings.runtime_kind,
    settings.runtime_path,
    settings.aisw_home,
    settings.update_channel,
  ]);

  useEffect(() => {
    setSelectedSection(initialSection ?? DEFAULT_SETTINGS_SECTION);
  }, [initialSection]);

  useEffect(() => {
    applyDesktopPreferencesDraft(
      createDesktopPreferencesDraft(desktopPreferences),
    );
    setLaunchMessage("");
  }, [desktopPreferences]);

  function applySettingsDraft(nextDraft: SettingsDraft) {
    setRuntimeKind(nextDraft.runtimeKind);
    setRuntimePath(nextDraft.runtimePath);
    setAiswHome(nextDraft.aiswHome);
    setUpdateChannel(nextDraft.updateChannel);
  }

  function applyDesktopPreferencesDraft(nextDraft: DesktopPreferencesDraft) {
    setAppearance(nextDraft.appearance);
    setDefaultSection(nextDraft.defaultSection);
    setShowMenuBarIcon(nextDraft.showMenuBarIcon);
    setRestoreWindowState(nextDraft.restoreWindowState);
  }

  async function copyText(value: string, label: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(clipboardUnavailableMessage(label));
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopyMessage(clipboardSuccessMessage(label));
  }

  async function exportReport() {
    setSecurityMessage("");
    try {
      const result = await exportDiagnosticBundle();
      const message = exportedDiagnosticMessage(result.filename);
      setSecurityMessage(message);
      void notifyDesktop({
        title: "Diagnostic report exported",
        body: message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : DEFAULT_ACTION_FAILURE_MESSAGE;
      setSecurityMessage(message);
    }
  }

  async function revealAppDataFolder() {
    setAdvancedMessage("");
    try {
      const path = await openAppDataFolder();
      setAdvancedMessage(openedAppDataFolderMessage(path));
      void notifyDesktop({
        title: "App data folder opened",
        body: path,
      });
    } catch (error) {
      const message = appDataFolderErrorMessage(error);
      setAdvancedMessage(message);
    }
  }

  function updateGeneralPreferences(
    next: Partial<
      Pick<
        DesktopPreferences,
        "appearance" | "defaultSection" | "showMenuBarIcon" | "restoreWindowState"
      >
    >,
  ) {
    const nextPreferences = buildDesktopPreferencesUpdate({
      desktopPreferences,
      draft: desktopPreferencesDraft,
      next,
    });
    applyDesktopPreferencesDraft(
      patchDesktopPreferencesDraft(desktopPreferencesDraft, next),
    );
    onUpdateDesktopPreferences?.(nextPreferences);
  }

  function resetOnboarding() {
    const nextPreferences = buildResetOnboardingPreferences({
      appearance,
      showMenuBarIcon,
      restoreWindowState,
    });
    onUpdateDesktopPreferences?.(nextPreferences);
    onResetOnboarding?.();
    setSelectedSection("general");
  }

  function resetWindowLayout() {
    clearPersistedWindowState();
    setAdvancedMessage(WINDOW_LAYOUT_RESET_MESSAGE);
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
    const targetSection = nextSettingsSection(currentSection, direction);
    if (targetSection === currentSection) {
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

    const direction = settingsSectionDirectionForKey(event.key);
    if (!direction) {
      return;
    }
    event.preventDefault();
    moveSectionSelection(section, direction);
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
              <h3>{sectionLabel(selectedSection)}</h3>
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
                      {SETTINGS_APPEARANCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>
                </SettingsGroup>

                <SettingsGroup title="Startup">
                  <ToggleRow
                    label="Launch at login"
                    description={launchAtLoginDescription(launchAtLoginSupported, launchAtLoginDetail)}
                    control={
                      <button
                        type="button"
                        role="switch"
                        className="settings-switch"
                        aria-label="Launch at login"
                        aria-checked={launchAtLoginEnabled}
                        disabled={
                          launchAtLogin.isLoading ||
                          launchAtLoginMutation.isPending ||
                          !launchAtLoginSupported
                        }
                        onClick={() => {
                          setLaunchMessage("");
                          launchAtLoginMutation.mutate(!launchAtLoginEnabled);
                        }}
                      />
                    }
                  />
                  <ToggleRow
                    label="Show menu bar icon"
                    control={
                      <button
                        type="button"
                        role="switch"
                        className="settings-switch"
                        aria-label="Show menu bar icon"
                        aria-checked={showMenuBarIcon}
                        onClick={() =>
                          updateGeneralPreferences({ showMenuBarIcon: !showMenuBarIcon })
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
                      {SETTINGS_DEFAULT_SECTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>
                </SettingsGroup>
                <SettingsGroup title="Window">
                  <ToggleRow
                    label="Restore previous window size and position"
                    control={
                      <button
                        type="button"
                        role="switch"
                        className="settings-switch"
                        aria-label="Restore previous window size and position"
                        aria-checked={restoreWindowState}
                        onClick={() =>
                          updateGeneralPreferences({
                            restoreWindowState: !restoreWindowState,
                          })
                        }
                      />
                    }
                  />
                </SettingsGroup>
                {launchMessage ? <p className="inline-note settings-feedback-note">{launchMessage}</p> : null}

              </div>
            ) : null}

            {selectedSection === "runtime" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="AISW Runtime">
                  <SettingsStaticRow label="Bundled runtime" value={runtimeStatus.version?.version ?? DATE_UNAVAILABLE_LABEL} />
                  <SettingsStaticRow
                    label="Status"
                    value={runtimeReadinessLabel(runtimeStatus.compatible)}
                  />
                  <SettingsStaticRow
                    label="Current path"
                    value={<code className="settings-path-value">{runtimePathValue}</code>}
                  />
                  <SettingsRow label="Runtime source">
                    <select
                      aria-label="Runtime source"
                      value={runtimeKind}
                      onChange={(event) => {
                        const nextRuntimeKind = event.target.value as typeof runtimeKind;
                        const nextSelection = nextRuntimeSourceSelection(
                          nextRuntimeKind,
                          runtimePath,
                        );
                        applySettingsDraft(
                          patchSettingsDraft(settingsDraft, nextSelection),
                        );
                        updateSettingsMutation.mutate(
                          buildSettingsRequest({
                            settings,
                            draft: settingsDraft,
                            next: nextSelection,
                          }),
                        );
                      }}
                    >
                      {SETTINGS_RUNTIME_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>
                  <SettingsStaticRow
                    label="System runtime"
                    value={<code className="settings-path-value">{runtimeStatus.inventory.system_path ?? NOT_FOUND_LABEL}</code>}
                  />
                  <SettingsRow label="Custom runtime">
                    <input
                      aria-label="Engine path"
                      value={runtimePath}
                      disabled={runtimeKind !== "custom"}
                      placeholder={runtimeKind === "custom" ? "/path/to/aisw" : ""}
                      onChange={(event) => setRuntimePath(event.target.value)}
                      onBlur={() => {
                        if (runtimeKind !== "custom") return;
                        updateSettingsMutation.mutate(
                          buildSettingsRequest({
                            settings,
                            draft: settingsDraft,
                            next: {
                              runtimePath,
                            },
                          }),
                        );
                      }}
                    />
                  </SettingsRow>
                </SettingsGroup>

                <SettingsGroup title="AISW Data">
                  <SettingsStaticRow label="AISW home" value={<code className="settings-path-value">{settings.aisw_home ?? "~/.aisw"}</code>} />
                  <SettingsActionRow
                    label="Local data folder"
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        Reveal in Finder
                      </button>
                    }
                  />
                </SettingsGroup>
                {updateSettingsMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title="Settings could not be saved"
                    details={formatSettingsMutationError(updateSettingsMutation.error)}
                  />
                ) : null}
                {advancedMessage ? <p className="inline-note">{advancedMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "shell" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Terminal Integration">
                  <SettingsStaticRow
                    label="Detected shell"
                    value={detectedShellLabel(shellGuidance.data?.detected_shell)}
                  />
                  <SettingsStaticRow
                    label="Shell hook"
                    value={shellHookStatusLabel(shellCheck?.status)}
                  />
                  <SettingsStaticRow
                    label="Config file"
                    value={<code className="settings-path-value">{shellConfigPathLabel(selectedVariant)}</code>}
                  />
                  <SettingsStaticRow label="Completion scripts" value={SHELL_COMPLETION_AVAILABLE_LABEL} />
                  {selectedVariant ? (
                    <SettingsActionRow
                      label="Shell hook actions"
                      action={
                        <div className="button-row">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => void copyText(selectedVariant.install_command, "setup")}
                          >
                            Copy Install
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => void copyText(selectedVariant.verify_command, "verify")}
                          >
                            Copy Verify
                          </button>
                        </div>
                      }
                    />
                  ) : (
                    <p className="inline-note">
                      {shellGuidanceFallbackLabel(shellGuidance.isLoading)}
                    </p>
                  )}
                </SettingsGroup>
                <p className="inline-note settings-feedback-note settings-section-note">
                  Current terminal sessions only need the hook when they must receive live environment changes immediately.
                </p>

                {copyMessage ? <p className="inline-note settings-feedback-note">{copyMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "keyring" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Credential Storage">
                  <SettingsStaticRow label="macOS Keychain" value="Available" />
                  <SettingsStaticRow label="File permissions" value="Correct" />
                  <SettingsStaticRow label="Remote sync" value="Disabled" />
                  <SettingsStaticRow label="Telemetry" value="Disabled" />
                </SettingsGroup>

                <SettingsGroup title="Local Data">
                  <SettingsStaticRow label="AISW data folder" value={<code className="settings-path-value">{settings.aisw_home ?? "~/.aisw"}</code>} />
                  <SettingsActionRow
                    label="Finder"
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        Reveal in Finder
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title="Diagnostics">
                  <SettingsActionRow
                    label="Support bundle"
                    action={
                      <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                        Copy Redacted Report…
                      </button>
                    }
                  />
                </SettingsGroup>
                {securityMessage ? <p className="inline-note settings-feedback-note">{securityMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "updates" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="AISW Desktop">
                  <SettingsStaticRow label="Current version" value={appVersion} />
                  <SettingsRow label="Update channel">
                    <select
                      aria-label="Update channel"
                      value={updateChannel}
                      onChange={(event) => {
                        const nextUpdateChannel = event.target.value;
                        setUpdateChannel(nextUpdateChannel);
                        updateSettingsMutation.mutate(
                          buildSettingsRequest({
                            settings,
                            draft: settingsDraft,
                            next: {
                              updateChannel: nextUpdateChannel,
                            },
                          }),
                        );
                      }}
                    >
                      {SETTINGS_UPDATE_CHANNEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
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
                          disabled={mutationLock.isBusy || checkForUpdatesMutation.isPending}
                          onClick={() => checkForUpdatesMutation.mutate()}
                        >
                          Check for Updates
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={
                            mutationLock.isBusy ||
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
                </SettingsGroup>

                <SettingsGroup title="Bundled AISW Engine">
                  <SettingsStaticRow label="Version" value={runtimeStatus.version?.version ?? DATE_UNAVAILABLE_LABEL} />
                  <SettingsStaticRow
                    label="Compatibility"
                    value={runtimeCompatibilityLabel(runtimeStatus.compatible)}
                  />
                </SettingsGroup>

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
                  <SettingsFeedback
                    tone="error"
                    title="Settings could not be saved"
                    details={formatSettingsMutationError(updateSettingsMutation.error)}
                  />
                ) : null}
                {checkForUpdatesMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title="Update check failed"
                    details={formatSettingsMutationError(checkForUpdatesMutation.error)}
                  />
                ) : null}
                {installUpdateMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title="Update install failed"
                    details={formatSettingsMutationError(installUpdateMutation.error)}
                  />
                ) : null}
              </div>
            ) : null}

            {selectedSection === "advanced" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Application State">
                  <SettingsActionRow
                    label="Setup assistant"
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
                  <SettingsActionRow
                    label="Setup state"
                    action={
                      <button className="ghost-button" type="button" onClick={resetOnboarding}>
                        Reset Onboarding
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title="Data">
                  <SettingsActionRow
                    label="Window layout"
                    action={
                      <button className="ghost-button" type="button" onClick={resetWindowLayout}>
                        Reset Window Layout
                      </button>
                    }
                  />
                  <SettingsActionRow
                    label="App data folder"
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        Open App Data Folder
                      </button>
                    }
                  />
                  <SettingsActionRow
                    label="Support bundle"
                    action={
                      <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                        Export Redacted Support Bundle…
                      </button>
                    }
                  />
                  <SettingsRow label="AISW home">
                    <input
                      aria-label="AISW home"
                      value={aiswHome}
                      onChange={(event) => setAiswHome(event.target.value)}
                      onBlur={() =>
                        updateSettingsMutation.mutate(
                          buildSettingsRequest({
                            settings,
                            draft: settingsDraft,
                            next: {
                              aiswHome,
                            },
                          }),
                        )
                      }
                    />
                  </SettingsRow>
                </SettingsGroup>
                {advancedMessage ? <p className="inline-note settings-feedback-note">{advancedMessage}</p> : null}
                {securityMessage ? <p className="inline-note settings-feedback-note">{securityMessage}</p> : null}
                {updateSettingsMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title="Settings could not be saved"
                    details={formatSettingsMutationError(updateSettingsMutation.error)}
                  />
                ) : null}
              </div>
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
      <div className="settings-row-value">{value}</div>
    </div>
  );
}

function SettingsActionRow({
  label,
  description,
  action,
}: {
  label: string;
  description?: string;
  action: ReactNode;
}) {
  return (
    <div className="settings-row settings-row-action">
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {description ? <p className="inline-note">{description}</p> : null}
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
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="settings-row settings-row-toggle">
      <div className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {description ? <p className="inline-note">{description}</p> : null}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}

function SettingsFeedback({
  title,
  details,
  tone = "neutral",
}: {
  title: string;
  details: { message: string; remediation?: string };
  tone?: "neutral" | "error";
}) {
  return (
    <div className={`settings-feedback settings-feedback-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <p className="settings-feedback-title">{title}</p>
      <p className="inline-note">{details.message}</p>
      {details.remediation ? <p className="inline-note">{details.remediation}</p> : null}
    </div>
  );
}
