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
    if (!shellGuidance.data?.variants.length) return;
    const preferred = shellGuidance.data.detected_shell;
    const next = shellGuidance.data.variants.find((variant) => variant.shell === preferred)?.shell
      ?? shellGuidance.data.variants[0].shell;
    setSelectedShell((current) => current || next);
  }, [shellGuidance.data]);

  useEffect(() => {
    setRuntimeKind(settings.runtime_kind);
    setRuntimePath(settings.runtime_path ?? "");
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
    setSelectedSection(initialSection ?? "general");
  }, [initialSection]);

  useEffect(() => {
    setAppearance(desktopPreferences?.appearance ?? "system");
    setDefaultSection(desktopPreferences?.defaultSection ?? "overview");
    setShowMenuBarIcon(desktopPreferences?.showMenuBarIcon ?? true);
    setLaunchMessage("");
  }, [desktopPreferences]);

  function buildSettingsRequest(next?: {
    runtimeKind?: DesktopSettings["runtime_kind"];
    runtimePath?: string;
    aiswHome?: string;
    updateChannel?: string;
  }): DesktopSettings {
    const nextRuntimeKind = next?.runtimeKind ?? runtimeKind;
    const nextRuntimePath = next?.runtimePath ?? runtimePath;
    const nextAiswHome = next?.aiswHome ?? aiswHome;
    const nextUpdateChannel = next?.updateChannel ?? updateChannel;

    return {
      runtime_kind: nextRuntimeKind,
      runtime_path: effectiveRuntimePath(nextRuntimeKind, nextRuntimePath) || null,
      aisw_home: nextAiswHome || null,
      update_channel: nextUpdateChannel,
      profile_labels: settings.profile_labels ?? {},
      profile_sets: settings.profile_sets,
    };
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
    const nextPreferences: DesktopPreferences = {
      appearance: next.appearance ?? appearance,
      defaultSection: next.defaultSection ?? defaultSection,
      showMenuBarIcon: next.showMenuBarIcon ?? showMenuBarIcon,
      reopenSetupAssistant: desktopPreferences?.reopenSetupAssistant ?? false,
    };
    setAppearance(nextPreferences.appearance);
    setDefaultSection(nextPreferences.defaultSection);
    setShowMenuBarIcon(nextPreferences.showMenuBarIcon);
    onUpdateDesktopPreferences?.(nextPreferences);
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
                    description={launchAtLoginSupported ? undefined : launchAtLoginDetail ?? "Launch at login is not available in this environment."}
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
                      {DEFAULT_SECTIONS.map((entry) => (
                        <option key={entry} value={entry}>
                          {titleCase(entry)}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>
                </SettingsGroup>
                {launchMessage ? <p className="inline-note settings-feedback-note">{launchMessage}</p> : null}

              </div>
            ) : null}

            {selectedSection === "runtime" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="AISW Runtime">
                  <SettingsStaticRow label="Bundled runtime" value={runtimeStatus.version?.version ?? "Date Unavailable"} />
                  <SettingsStaticRow
                    label="Status"
                    value={runtimeStatus.compatible ? "Ready" : "Needs Attention"}
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
                        const nextRuntimePath =
                          nextRuntimeKind === "custom" ? runtimePath : "";
                        setRuntimeKind(nextRuntimeKind);
                        setRuntimePath(nextRuntimePath);
                        updateSettingsMutation.mutate(
                          buildSettingsRequest({
                            runtimeKind: nextRuntimeKind,
                            runtimePath: nextRuntimePath,
                          }),
                        );
                      }}
                    >
                      <option value="bundled">Bundled</option>
                      <option value="system">System engine</option>
                      <option value="custom">Custom path</option>
                    </select>
                  </SettingsRow>
                  <SettingsStaticRow
                    label="System runtime"
                    value={<code className="settings-path-value">{runtimeStatus.inventory.system_path ?? "Not found"}</code>}
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
                            runtimePath,
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
                  <MutationErrorCard title="Settings could not be saved" error={updateSettingsMutation.error} />
                ) : null}
                {advancedMessage ? <p className="inline-note">{advancedMessage}</p> : null}
              </div>
            ) : null}

            {selectedSection === "shell" ? (
              <div className="settings-section-stack">
                <SettingsGroup title="Terminal Integration">
                  <SettingsStaticRow
                    label="Detected shell"
                    value={
                      shellGuidance.data?.detected_shell
                        ? titleCase(shellGuidance.data.detected_shell)
                        : "Unavailable"
                    }
                  />
                  <SettingsStaticRow
                    label="Shell hook"
                    value={
                      shellCheck?.status === "pass"
                        ? "Installed"
                        : shellCheck?.status === "warn"
                          ? "Not installed"
                          : "Unavailable"
                    }
                  />
                  <SettingsStaticRow
                    label="Config file"
                    value={<code className="settings-path-value">{selectedVariant?.config_path ?? "Unavailable"}</code>}
                  />
                  <SettingsStaticRow label="Completion scripts" value="Available in this build" />
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
                      {shellGuidance.isLoading
                        ? "Loading shell guidance…"
                        : "Terminal setup guidance is unavailable."}
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
                            updateChannel: nextUpdateChannel,
                          }),
                        );
                      }}
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
                  <SettingsStaticRow label="Version" value={runtimeStatus.version?.version ?? "Date Unavailable"} />
                  <SettingsStaticRow
                    label="Compatibility"
                    value={runtimeStatus.compatible ? "Supported" : "Needs Attention"}
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
                  <MutationErrorCard title="Settings could not be saved" error={updateSettingsMutation.error} />
                ) : null}
                {checkForUpdatesMutation.error ? (
                  <MutationErrorCard title="Update check failed" error={checkForUpdatesMutation.error} />
                ) : null}
                {installUpdateMutation.error ? (
                  <MutationErrorCard title="Update install failed" error={installUpdateMutation.error} />
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
                            aiswHome,
                          }),
                        )
                      }
                    />
                  </SettingsRow>
                </SettingsGroup>
                {advancedMessage ? <p className="inline-note settings-feedback-note">{advancedMessage}</p> : null}
                {securityMessage ? <p className="inline-note settings-feedback-note">{securityMessage}</p> : null}
                {updateSettingsMutation.error ? (
                  <MutationErrorCard title="Settings could not be saved" error={updateSettingsMutation.error} />
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
