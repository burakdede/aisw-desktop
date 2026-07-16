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
import { normalizeDesktopUpdateChannel } from "../../../lib/desktop-settings";
import {
  DATE_UNAVAILABLE_LABEL,
  DEFAULT_ACTION_FAILURE_MESSAGE,
  NOT_FOUND_LABEL,
} from "../../../lib/display-copy";
import { resolveErrorMessage } from "../../../lib/error-details";
import { notifyDesktop } from "../../../lib/notifications";
import {
  detectedShellLabel,
  SHELL_COMPLETION_AVAILABLE_LABEL,
  selectedShellValue,
  selectedShellVariant,
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
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "../../../lib/settings-sections";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import {
  buildDesktopPreferencesUpdate,
  buildRuntimeSelectionSettings,
  createDesktopPreferencesDraft,
  createSettingsDraft,
  buildResetOnboardingPreferences,
  buildSettingsRequest,
  patchDesktopPreferencesDraft,
  patchSettingsDraft,
  clipboardSuccessMessage,
  clipboardUnavailableMessage,
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
  buildUpdateCheckResultLines,
  releaseChannelDescription,
  sectionLabel,
  selectedRuntimePath,
  SETTINGS_CHECK_FOR_UPDATES_LABEL,
  SETTINGS_COPY_REDACTED_REPORT_LABEL,
  SETTINGS_APPEARANCE_OPTIONS,
  SETTINGS_DEFAULT_SECTION_OPTIONS,
  SETTINGS_EXPORT_REDACTED_SUPPORT_BUNDLE_LABEL,
  SETTINGS_INSTALLING_UPDATE_LABEL,
  SETTINGS_INSTALL_UPDATE_LABEL,
  SETTINGS_OPEN_APP_DATA_FOLDER_LABEL,
  SETTINGS_PANEL_COPY,
  SETTINGS_RESET_ONBOARDING_LABEL,
  SETTINGS_RESET_WINDOW_LAYOUT_LABEL,
  SETTINGS_REOPEN_SETUP_ASSISTANT_LABEL,
  SETTINGS_REVEAL_IN_FINDER_LABEL,
  SETTINGS_RUNTIME_SOURCE_OPTIONS,
  SETTINGS_SAVE_FAILED_TITLE,
  settingsSectionDirectionForKey,
  SETTINGS_SHELL_NOTE,
  SETTINGS_UPDATE_CHECK_FAILED_TITLE,
  SETTINGS_UPDATE_INSTALL_FAILED_TITLE,
  SETTINGS_UPDATE_CHANNEL_OPTIONS,
  type DesktopPreferencesDraft,
  type SettingsDraft,
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
    () => selectedShellVariant(shellGuidance.data, selectedShell),
    [selectedShell, shellGuidance.data],
  );
  const launchAtLoginSupported = launchAtLogin.data?.supported ?? false;
  const launchAtLoginEnabled = launchAtLogin.data?.enabled ?? false;
  const launchAtLoginDetail = launchAtLogin.data?.detail;
  const runtimePathValue = selectedRuntimePath(
    buildRuntimeSelectionSettings(settings, {
      runtimeKind,
      runtimePath,
    }),
    runtimeStatus,
  );

  useEffect(() => {
    const next = selectedShellValue(shellGuidance.data, selectedShell);
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
      const message = resolveErrorMessage(error, DEFAULT_ACTION_FAILURE_MESSAGE);
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
          <span className="settings-field-label">{SETTINGS_PANEL_COPY.mobilePickerLabel}</span>
          <select
            aria-label={SETTINGS_PANEL_COPY.mobilePickerAriaLabel}
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
        <aside
          className="settings-category-pane"
          aria-label={SETTINGS_PANEL_COPY.sectionNavAriaLabel}
        >
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
                <SettingsGroup title={SETTINGS_PANEL_COPY.general.groups.appearance}>
                  <SettingsRow label={SETTINGS_PANEL_COPY.general.rows.appearance}>
                    <select
                      aria-label={SETTINGS_PANEL_COPY.general.rows.appearance}
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

                <SettingsGroup title={SETTINGS_PANEL_COPY.general.groups.startup}>
                  <ToggleRow
                    label={SETTINGS_PANEL_COPY.general.rows.launchAtLogin}
                    description={launchAtLoginDescription(launchAtLoginSupported, launchAtLoginDetail)}
                    control={
                      <button
                        type="button"
                        role="switch"
                        className="settings-switch"
                        aria-label={SETTINGS_PANEL_COPY.general.rows.launchAtLogin}
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
                    label={SETTINGS_PANEL_COPY.general.rows.showMenuBarIcon}
                    control={
                      <button
                        type="button"
                        role="switch"
                        className="settings-switch"
                        aria-label={SETTINGS_PANEL_COPY.general.rows.showMenuBarIcon}
                        aria-checked={showMenuBarIcon}
                        onClick={() =>
                          updateGeneralPreferences({ showMenuBarIcon: !showMenuBarIcon })
                        }
                      />
                    }
                  />
                  <SettingsRow label={SETTINGS_PANEL_COPY.general.rows.openAtLaunch}>
                    <select
                      aria-label={SETTINGS_PANEL_COPY.general.defaultSectionAriaLabel}
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
                <SettingsGroup title={SETTINGS_PANEL_COPY.general.groups.window}>
                  <ToggleRow
                    label={SETTINGS_PANEL_COPY.general.rows.restoreWindowState}
                    control={
                      <button
                        type="button"
                        role="switch"
                        className="settings-switch"
                        aria-label={SETTINGS_PANEL_COPY.general.rows.restoreWindowState}
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
                <SettingsGroup title={SETTINGS_PANEL_COPY.runtime.groups.runtime}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.runtime.rows.bundledRuntime}
                    value={runtimeStatus.version?.version ?? DATE_UNAVAILABLE_LABEL}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.runtime.rows.status}
                    value={runtimeReadinessLabel(runtimeStatus.compatible)}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.runtime.rows.currentPath}
                    value={<code className="settings-path-value">{runtimePathValue}</code>}
                  />
                  <SettingsRow label={SETTINGS_PANEL_COPY.runtime.rows.runtimeSource}>
                    <select
                      aria-label={SETTINGS_PANEL_COPY.runtime.rows.runtimeSource}
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
                    label={SETTINGS_PANEL_COPY.runtime.rows.systemRuntime}
                    value={<code className="settings-path-value">{runtimeStatus.inventory.system_path ?? NOT_FOUND_LABEL}</code>}
                  />
                  <SettingsRow label={SETTINGS_PANEL_COPY.runtime.rows.customRuntime}>
                    <input
                      aria-label={SETTINGS_PANEL_COPY.runtime.customPathAriaLabel}
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

                <SettingsGroup title={SETTINGS_PANEL_COPY.runtime.groups.data}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.runtime.rows.aiswHome}
                    value={<code className="settings-path-value">{settings.aisw_home ?? "~/.aisw"}</code>}
                  />
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.runtime.rows.localDataFolder}
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        {SETTINGS_REVEAL_IN_FINDER_LABEL}
                      </button>
                    }
                  />
                </SettingsGroup>
                {updateSettingsMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title={SETTINGS_SAVE_FAILED_TITLE}
                    details={formatSettingsMutationError(updateSettingsMutation.error)}
                  />
                ) : null}
                {advancedMessage ? <p className="inline-note">{advancedMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "shell" ? (
              <div className="settings-section-stack">
                <SettingsGroup title={SETTINGS_PANEL_COPY.shell.groupTitle}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.shell.rows.detectedShell}
                    value={detectedShellLabel(shellGuidance.data?.detected_shell)}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.shell.rows.shellHook}
                    value={shellHookStatusLabel(shellCheck?.status)}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.shell.rows.configFile}
                    value={<code className="settings-path-value">{shellConfigPathLabel(selectedVariant)}</code>}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.shell.rows.completionScripts}
                    value={SHELL_COMPLETION_AVAILABLE_LABEL}
                  />
                  {selectedVariant ? (
                    <SettingsActionRow
                      label={SETTINGS_PANEL_COPY.shell.rows.shellHookActions}
                      action={
                        <div className="button-row">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => void copyText(selectedVariant.install_command, "setup")}
                          >
                            {SETTINGS_PANEL_COPY.shell.installButton}
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => void copyText(selectedVariant.verify_command, "verify")}
                          >
                            {SETTINGS_PANEL_COPY.shell.verifyButton}
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
                  {SETTINGS_SHELL_NOTE}
                </p>

                {copyMessage ? <p className="inline-note settings-feedback-note">{copyMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "keyring" ? (
              <div className="settings-section-stack">
                <SettingsGroup title={SETTINGS_PANEL_COPY.keyring.groups.storage}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.macosKeychain}
                    value={SETTINGS_PANEL_COPY.keyring.values.available}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.filePermissions}
                    value={SETTINGS_PANEL_COPY.keyring.values.correct}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.remoteSync}
                    value={SETTINGS_PANEL_COPY.keyring.values.disabled}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.telemetry}
                    value={SETTINGS_PANEL_COPY.keyring.values.disabled}
                  />
                </SettingsGroup>

                <SettingsGroup title={SETTINGS_PANEL_COPY.keyring.groups.localData}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.aiswDataFolder}
                    value={<code className="settings-path-value">{settings.aisw_home ?? "~/.aisw"}</code>}
                  />
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.finder}
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        {SETTINGS_REVEAL_IN_FINDER_LABEL}
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title={SETTINGS_PANEL_COPY.keyring.groups.diagnostics}>
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.keyring.rows.supportBundle}
                    action={
                      <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                        {SETTINGS_COPY_REDACTED_REPORT_LABEL}
                      </button>
                    }
                  />
                </SettingsGroup>
                {securityMessage ? <p className="inline-note settings-feedback-note">{securityMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "updates" ? (
              <div className="settings-section-stack">
                <SettingsGroup title={SETTINGS_PANEL_COPY.updates.groups.desktop}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.updates.rows.currentVersion}
                    value={appVersion}
                  />
                  <SettingsRow label={SETTINGS_PANEL_COPY.updates.rows.updateChannel}>
                    <select
                      aria-label={SETTINGS_PANEL_COPY.updates.rows.updateChannel}
                      value={updateChannel}
                      onChange={(event) => {
                        const nextUpdateChannel = normalizeDesktopUpdateChannel(
                          event.target.value,
                        );
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
                    label={SETTINGS_PANEL_COPY.updates.rows.availableReleases}
                    description={releaseChannelDescription(updateChannel)}
                    action={
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={mutationLock.isBusy || checkForUpdatesMutation.isPending}
                          onClick={() => checkForUpdatesMutation.mutate()}
                        >
                          {SETTINGS_CHECK_FOR_UPDATES_LABEL}
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
                          {installUpdateMutation.isPending
                            ? SETTINGS_INSTALLING_UPDATE_LABEL
                            : SETTINGS_INSTALL_UPDATE_LABEL}
                        </button>
                      </div>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title={SETTINGS_PANEL_COPY.updates.groups.bundledRuntime}>
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.updates.rows.version}
                    value={runtimeStatus.version?.version ?? DATE_UNAVAILABLE_LABEL}
                  />
                  <SettingsStaticRow
                    label={SETTINGS_PANEL_COPY.updates.rows.compatibility}
                    value={runtimeCompatibilityLabel(runtimeStatus.compatible)}
                  />
                </SettingsGroup>

                {checkForUpdatesMutation.data ? (
                  <div className="settings-result-list">
                    {buildUpdateCheckResultLines(checkForUpdatesMutation.data).map((line) => (
                      <p key={line} className="inline-note">
                        {line}
                      </p>
                    ))}
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
                    title={SETTINGS_SAVE_FAILED_TITLE}
                    details={formatSettingsMutationError(updateSettingsMutation.error)}
                  />
                ) : null}
                {checkForUpdatesMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title={SETTINGS_UPDATE_CHECK_FAILED_TITLE}
                    details={formatSettingsMutationError(checkForUpdatesMutation.error)}
                  />
                ) : null}
                {installUpdateMutation.error ? (
                  <SettingsFeedback
                    tone="error"
                    title={SETTINGS_UPDATE_INSTALL_FAILED_TITLE}
                    details={formatSettingsMutationError(installUpdateMutation.error)}
                  />
                ) : null}
              </div>
            ) : null}

            {selectedSection === "advanced" ? (
              <div className="settings-section-stack">
                <SettingsGroup title={SETTINGS_PANEL_COPY.advanced.groups.applicationState}>
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.advanced.rows.setupAssistant}
                    action={
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={!onReopenSetupAssistant}
                        onClick={onReopenSetupAssistant}
                      >
                        {SETTINGS_REOPEN_SETUP_ASSISTANT_LABEL}
                      </button>
                    }
                  />
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.advanced.rows.setupState}
                    action={
                      <button className="ghost-button" type="button" onClick={resetOnboarding}>
                        {SETTINGS_RESET_ONBOARDING_LABEL}
                      </button>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title={SETTINGS_PANEL_COPY.advanced.groups.data}>
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.advanced.rows.windowLayout}
                    action={
                      <button className="ghost-button" type="button" onClick={resetWindowLayout}>
                        {SETTINGS_RESET_WINDOW_LAYOUT_LABEL}
                      </button>
                    }
                  />
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.advanced.rows.appDataFolder}
                    action={
                      <button className="ghost-button" type="button" onClick={() => void revealAppDataFolder()}>
                        {SETTINGS_OPEN_APP_DATA_FOLDER_LABEL}
                      </button>
                    }
                  />
                  <SettingsActionRow
                    label={SETTINGS_PANEL_COPY.advanced.rows.supportBundle}
                    action={
                      <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                        {SETTINGS_EXPORT_REDACTED_SUPPORT_BUNDLE_LABEL}
                      </button>
                    }
                  />
                  <SettingsRow label={SETTINGS_PANEL_COPY.advanced.rows.aiswHome}>
                    <input
                      aria-label={SETTINGS_PANEL_COPY.advanced.aiswHomeAriaLabel}
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
                    title={SETTINGS_SAVE_FAILED_TITLE}
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
