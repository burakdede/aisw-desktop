import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import { exportDiagnosticBundle, getShellGuidance, runDoctor } from "../../../lib/client";
import {
  DEFAULT_SECTIONS,
  DESKTOP_APPEARANCES,
  type DesktopPreferences,
} from "../../../lib/desktop-preferences";
import { notifyDesktop } from "../../../lib/notifications";
import { DesktopCommandError } from "../../../lib/tauri";
import { DesktopSettings, AppBootstrap } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
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
}: {
  settings: DesktopSettings;
  runtimeStatus: AppBootstrap["runtime_status"];
  initialSection?: SettingsSection;
  desktopPreferences?: DesktopPreferences;
  onUpdateDesktopPreferences?: (preferences: DesktopPreferences) => void;
}) {
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
  const [selectedShell, setSelectedShell] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [appearance, setAppearance] = useState<DesktopPreferences["appearance"]>(
    desktopPreferences?.appearance ?? "system",
  );
  const [defaultSection, setDefaultSection] = useState<DesktopPreferences["defaultSection"]>(
    desktopPreferences?.defaultSection ?? "overview",
  );
  const [generalMessage, setGeneralMessage] = useState("");
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(
    initialSection ?? "general",
  );

  const shellCheck = useMemo(() => findShellHookCheck(doctor.data), [doctor.data]);
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
    setGeneralMessage("");
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
      setCopyMessage(`Clipboard access is unavailable. Copy the ${label} command manually.`);
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopyMessage(`Copied ${label} command.`);
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
        error instanceof Error ? error.message : "Desktop command failed.";
      setSecurityMessage(message);
      void notifyDesktop({
        title: "Diagnostic export failed",
        body: message,
      });
    }
  }

  function saveGeneralPreferences() {
    onUpdateDesktopPreferences?.({
      appearance,
      defaultSection,
    });
    setGeneralMessage("General preferences saved.");
  }

  return (
    <SectionCard title="Settings" kicker={sectionKicker(selectedSection)}>
      <div className="settings-status-strip" aria-label="Settings highlights">
        <article className="settings-status-card">
          <p className="card-kicker">Section</p>
          <p className="settings-status-value">{sectionLabel(selectedSection)}</p>
          <p className="inline-note">{sourceListSummary(selectedSection)}</p>
        </article>
        <article className="settings-status-card">
          <p className="card-kicker">Behavior</p>
          <p className="settings-status-value">{sectionHeading(selectedSection)}</p>
          <p className="inline-note">{sectionDescription(selectedSection)}</p>
        </article>
        <article className="settings-status-card">
          <p className="card-kicker">Highlights</p>
          <div className="settings-status-pill-stack">
            {sectionPills(selectedSection).map((pill) => (
              <span key={pill} className="status-pill">
                {pill}
              </span>
            ))}
          </div>
        </article>
      </div>
      <SplitView
        className="settings-split"
        primaryClassName="settings-nav-pane"
        secondaryClassName="settings-detail-pane"
        primary={
          <article className="diagnostic-card desktop-source-card settings-nav-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Categories</p>
                <h3>Preferences</h3>
              </div>
            </div>
            <div className="desktop-source-list" aria-label="Settings sections">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  aria-label={sectionLabel(section)}
                  aria-describedby={`settings-section-summary-${section}`}
                  aria-pressed={selectedSection === section}
                  className={`desktop-source-row ${
                    selectedSection === section ? "desktop-source-row-selected" : ""
                  }`}
                  onClick={() => setSelectedSection(section)}
                >
                  <div>
                    <strong>{sectionLabel(section)}</strong>
                    <p
                      id={`settings-section-summary-${section}`}
                      className="inline-note"
                    >
                      {sourceListSummary(section)}
                    </p>
                  </div>
                  <span className="desktop-source-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </article>
        }
        secondary={
      <div className="settings-pane">
        {selectedSection === "general" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <div className="stack-list">
              <article className="diagnostic-card settings-pane-intro">
                <h3>General</h3>
                <p className="inline-note">
                  Keep the app aligned with the operating system and preserve one consistent desktop switching model.
                </p>
              </article>
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Appearance</p>
                    <h3>Desktop appearance</h3>
                  </div>
                  <p className="inline-note">
                    Choose whether AI Switch follows the system or pins the window to a light or dark appearance.
                  </p>
                </div>
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
                <p className="inline-note">
                  System keeps the window aligned with the OS. Light and Dark pin the app to one appearance until you change it again.
                </p>
              </article>
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Launch</p>
                    <h3>Default section</h3>
                  </div>
                  <p className="inline-note">
                    Choose which section opens first when the desktop app starts normally.
                  </p>
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
                <p className="inline-note">
                  Engine blockers and first-run onboarding still take priority when they need your attention.
                </p>
                <div className="button-row">
                  <button className="primary-button" type="button" onClick={saveGeneralPreferences}>
                    Save general preferences
                  </button>
                </div>
                {generalMessage ? <p className="inline-note">{generalMessage}</p> : null}
              </article>
            </div>
            <div className="stack-list">
              <article className="diagnostic-card diagnostic-pass settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Model</p>
                    <h3>Desktop behavior</h3>
                  </div>
                  <p className="inline-note">
                    This app stays a local control surface over the switching engine rather than becoming a separate credential manager.
                  </p>
                </div>
                <p className="inline-note">Credentials stay local.</p>
                <p className="inline-note">No telemetry or prompt proxy is used.</p>
                <p className="inline-note">Every switch, verify, and repair flow uses the same desktop interaction model.</p>
              </article>
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Navigation</p>
                    <h3>Preference sections</h3>
                  </div>
                  <p className="inline-note">
                    The preferences window is split into native-style categories so runtime, terminal, security, updates, and advanced details stay focused instead of appearing in one long settings page.
                  </p>
                </div>
                <p className="inline-note">Use the source list on the left to jump directly to the section you need.</p>
                <p className="inline-note">
                  Launch-at-login and menu bar persistence stay tied to the signed desktop build and OS-level app settings for now.
                </p>
              </article>
            </div>
          </div>
        ) : null}

        {selectedSection === "runtime" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <form className="stacked-form settings-form" onSubmit={submit}>
              <article className="diagnostic-card settings-pane-intro">
                <h3>Preferred setup</h3>
                <p className="inline-note">
                  Keep the desktop app on its included engine unless you intentionally need an advanced override.
                </p>
              </article>
              <article
                className={`diagnostic-card ${runtimeKind === "bundled" ? "diagnostic-pass" : "diagnostic-warn"}`}
              >
                <h3>Recommended engine</h3>
                <p className="inline-note">
                  This app ships with a compatible engine and uses it by default.
                </p>
                <p className="inline-note">
                  Use a system or custom engine only when you intentionally need to override the supported desktop bundle.
                </p>
              </article>

              {runtimeKind !== "bundled" ? (
                <article className="diagnostic-card diagnostic-warn">
                  <h3>Advanced engine override is active</h3>
                  <p className="inline-note">
                    This desktop session is using a{" "}
                    {runtimeKind === "system" ? "system" : "custom"} engine binary instead of the included engine.
                  </p>
                  <p className="inline-note">
                    Compatibility for onboarding, switching, and diagnostics is only guaranteed with the included engine shipped in this app release.
                  </p>
                </article>
              ) : null}

              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Engine</p>
                    <h3>Engine source</h3>
                  </div>
                  <p className="inline-note">
                    Keep the included engine selected unless you intentionally need a compatibility override.
                  </p>
                </div>
                {showAdvancedRuntime ? (
                  <>
                    <label>
                      Engine source
                      <select
                        value={runtimeKind}
                        onChange={(event) =>
                          setRuntimeKind(event.target.value as typeof runtimeKind)
                        }
                      >
                        <option value="bundled">Included engine</option>
                        <option value="system">System engine</option>
                        <option value="custom">Custom path</option>
                      </select>
                    </label>
                    <label>
                      Engine path
                      <input
                        value={runtimePath}
                        disabled={runtimeKind !== "custom"}
                        placeholder={
                          runtimeKind === "custom"
                            ? "/path/to/engine"
                            : "Only used for a custom engine"
                        }
                        onChange={(event) => setRuntimePath(event.target.value)}
                      />
                    </label>
                    {runtimeKind === "bundled" ? (
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setShowAdvancedRuntime(false)}
                        >
                          Hide advanced engine options
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="button-row">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setShowAdvancedRuntime(true)}
                    >
                      Show advanced engine options
                    </button>
                  </div>
                )}
              </article>

              <button
                className="primary-button"
                type="submit"
                disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? "Saving…" : "Save settings"}
              </button>
            </form>
            <div className="stack-list diagnostics-body">
              {updateSettingsMutation.error ? (
                <MutationErrorCard
                  title="Settings could not be saved"
                  error={updateSettingsMutation.error}
                />
              ) : null}
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Status</p>
                    <h3>Engine summary</h3>
                  </div>
                  <p className="inline-note">
                    Keep the current engine model visible without pushing raw paths into the main preferences flow.
                  </p>
                </div>
                <p className="inline-note">
                  Engine source:{" "}
                  <strong>
                    {runtimeKind === "bundled"
                      ? "Included with this app"
                      : runtimeKind === "system"
                        ? "System override"
                        : "Custom override"}
                  </strong>
                </p>
                <p className="inline-note">
                  Compatibility:{" "}
                  <strong>{runtimeStatus.compatible ? "Ready for desktop switching" : "Needs attention"}</strong>
                </p>
                <p className="inline-note">
                  Engine mode: <strong>{titleCase(runtimeKind)}</strong>
                </p>
                <p className="inline-note">
                  Engine version: {runtimeStatus.version?.version ?? "unknown"}
                </p>
              </article>
            </div>
          </div>
        ) : null}

        {selectedSection === "updates" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <div className="stack-list">
              <article className="diagnostic-card settings-pane-intro">
                <h3>Signed desktop releases</h3>
                <p className="inline-note">
                  Choose the release track for this Mac, then check for signed desktop updates.
                </p>
              </article>
              <form className="stacked-form settings-form" onSubmit={submit}>
                <article className="diagnostic-card settings-pane-section">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Updates</p>
                      <h3>Release track</h3>
                    </div>
                    <p className="inline-note">
                      Stable is recommended for day-to-day switching. Beta is for earlier builds.
                    </p>
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
                </article>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? "Saving…" : "Save settings"}
                </button>
              </form>
              {updateSettingsMutation.error ? (
                <MutationErrorCard
                  title="Settings could not be saved"
                  error={updateSettingsMutation.error}
                />
              ) : null}
            </div>
            <div className="stack-list">
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Check</p>
                    <h3>Available releases</h3>
                  </div>
                  <p className="inline-note">
                    Check for a signed desktop release on the selected {updateChannel} channel.
                  </p>
                </div>
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
                    {checkForUpdatesMutation.isPending ? "Checking…" : "Check for updates"}
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
                    {installUpdateMutation.isPending ? "Installing…" : "Install update"}
                  </button>
                </div>
                {hasPendingSettingsChanges ? (
                  <p className="inline-note">
                    Save settings before checking for updates so the runtime and channel selection match
                    the persisted desktop configuration.
                  </p>
                ) : null}
                {checkForUpdatesMutation.data ? (
                  <div className="stack-list">
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
        ) : null}

        {selectedSection === "shell" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <div className="stack-list">
              <article className="diagnostic-card settings-pane-intro">
                <h3>Terminal Integration</h3>
                <p className="inline-note">
                  Install terminal integration only when you want current shells to react immediately after a switch.
                </p>
              </article>
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Terminal</p>
                    <h3>Current terminal session</h3>
                  </div>
                  <p className="inline-note">
                    Terminal integration is optional, but recommended when you want immediate environment exports in the current shell session.
                  </p>
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
                <p className="inline-note">
                  Detected shell:{" "}
                  <strong>
                    {shellGuidance.data?.detected_shell
                      ? titleCase(shellGuidance.data.detected_shell)
                      : "Unknown"}
                  </strong>
                </p>
                {shellGuidance.data ? (
                  <>
                    <div className="stack-list">
                      {shellGuidance.data.capabilities.map((item) => (
                        <p key={item} className="inline-note">
                          {item}
                        </p>
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
            <div className="stack-list">
              {selectedVariant ? (
                <article className="diagnostic-card settings-pane-section">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Guide</p>
                      <h3>{selectedVariant.title} shell setup</h3>
                    </div>
                    <p className="inline-note">
                      Copy the setup, reload, and verify commands for this shell.
                    </p>
                  </div>
                  <p className="inline-note">Config file: {selectedVariant.config_path}</p>
                  {selectedVariant.alternate_config_path ? (
                    <p className="inline-note">
                      Alternative: {selectedVariant.alternate_config_path}
                    </p>
                  ) : null}
                  <div className="stack-list">
                    <div>
                      <p className="inline-note">Install</p>
                      <pre>{selectedVariant.install_command}</pre>
                      <div className="button-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            void copyText(selectedVariant.install_command, "setup")
                          }
                        >
                          Copy setup command
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="inline-note">Reload</p>
                      <pre>{selectedVariant.reload_command}</pre>
                      <div className="button-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            void copyText(selectedVariant.reload_command, "reload")
                          }
                        >
                          Copy reload command
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="inline-note">Verify</p>
                      <pre>{selectedVariant.verify_command}</pre>
                      <p className="inline-note">
                        Expected output: {selectedVariant.verify_expected}
                      </p>
                      <div className="button-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            void copyText(selectedVariant.verify_command, "verify")
                          }
                        >
                          Copy verify command
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}
              {shellGuidance.data ? (
                <article className="diagnostic-card">
                  <h3>Without terminal integration</h3>
                  <p className="inline-note">{shellGuidance.data.note}</p>
                  <p className="inline-note">Advanced command-line examples:</p>
                  {shellGuidance.data.manual_apply_examples.map((example) => (
                    <pre key={example}>{example}</pre>
                  ))}
                </article>
              ) : null}
              {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
            </div>
          </div>
        ) : null}

        {selectedSection === "keyring" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <div className="stack-list">
              <article className="diagnostic-card settings-pane-intro">
                <h3>Security</h3>
                <p className="inline-note">
                  The desktop app keeps credentials local and leans on the operating system for secure storage.
                </p>
              </article>
              <article className="diagnostic-card diagnostic-pass settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Privacy</p>
                    <h3>Privacy and storage</h3>
                  </div>
                  <p className="inline-note">
                    Review the security model before changing credential or engine settings.
                  </p>
                </div>
                <p className="inline-note">Credentials stay local to this Mac or workstation.</p>
                <p className="inline-note">
                  No telemetry or remote credential proxy is used for switching.
                </p>
                <p className="inline-note">
                  Native keyrings remain preferred whenever the OS provides them.
                </p>
              </article>
            </div>
            <div className="stack-list">
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Diagnostics</p>
                    <h3>Redacted support report</h3>
                  </div>
                  <p className="inline-note">
                    Export a redacted bundle before sharing troubleshooting details or filing a support request.
                  </p>
                </div>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => void exportReport()}>
                    Export redacted diagnostic report
                  </button>
                </div>
                {securityMessage ? <p className="inline-note">{securityMessage}</p> : null}
              </article>
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Recovery</p>
                    <h3>Keyring recovery guides</h3>
                  </div>
                  <p className="inline-note">
                    If diagnostics report a keyring failure, use the matching OS steps below.
                  </p>
                </div>
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
        ) : null}

        {selectedSection === "advanced" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <form className="stacked-form settings-form" onSubmit={submit}>
              <article className="diagnostic-card settings-pane-intro">
                <h3>Advanced</h3>
                <p className="inline-note">
                  Keep storage overrides, raw runtime paths, and low-level desktop details in one place so the main preferences stay approachable.
                </p>
              </article>
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Storage</p>
                    <h3>Desktop storage</h3>
                  </div>
                  <p className="inline-note">
                    Leave this empty to use the managed desktop data location.
                  </p>
                </div>
                <label>
                  Desktop storage override
                  <input value={aiswHome} onChange={(event) => setAiswHome(event.target.value)} />
                </label>
              </article>
              <button
                className="primary-button"
                type="submit"
                disabled={mutationLock.isBusy || updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? "Saving…" : "Save settings"}
              </button>
            </form>
            <div className="stack-list">
              {updateSettingsMutation.error ? (
                <MutationErrorCard
                  title="Settings could not be saved"
                  error={updateSettingsMutation.error}
                />
              ) : null}
              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Status</p>
                    <h3>Runtime details</h3>
                  </div>
                  <p className="inline-note">
                    Review desktop storage, compatibility, and runtime availability without cluttering the main preferences.
                  </p>
                </div>
                <p className="inline-note">
                  Desktop storage:{" "}
                  {settings.aisw_home ? `Custom folder (${settings.aisw_home})` : "Managed automatically"}
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
                  Active runtime source:{" "}
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
                    {runtimeStatus.inventory.bundled_path ? "Available in this build" : "Not included in this build"}
                  </strong>
                </p>
                <p className="inline-note">
                  System runtime:{" "}
                  <strong>{runtimeStatus.inventory.system_path ? "Found on this Mac" : "Not found"}</strong>
                </p>
                {runtimeStatus.inventory.configured_path ? (
                  <p className="inline-note">
                    Custom runtime override is configured.
                  </p>
                ) : null}
              </article>
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
      "Approve any keychain access prompts for the desktop app, Claude, Codex, or Gemini.",
      "If access keeps failing, lock and unlock the login keychain, then rerun diagnostics.",
    ],
    verify: "Rerun diagnostics and confirm the keyring warning disappears.",
  },
  {
    platform: "windows",
    title: "Windows Credential Manager",
    backend: "Credential Manager / DPAPI",
    steps: [
      "Stay signed in to a normal desktop session before launching the desktop app.",
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
      "Make sure the desktop session has an active D-Bus user session before launching the desktop app.",
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
    message: "Desktop command failed.",
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
      detail:
        (check.detail ?? "")
          .replace(
            "Shell hook is not active in the current shell session.",
            "Terminal integration is not active in the current shell session.",
          )
          .replace(
            "Install the shell hook and reload the shell.",
            "Install terminal integration and reload the shell.",
          ),
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

function sectionKicker(section: SettingsSection) {
  switch (section) {
    case "general":
      return "Appearance, launch, and desktop behavior";
    case "runtime":
      return "Included engine and advanced overrides";
    case "updates":
      return "Signed desktop releases";
    case "shell":
      return "Shell setup and current-session switching";
    case "keyring":
      return "Local credential storage and recovery";
    case "advanced":
      return "Low-level paths, storage, and release details";
  }
}

function sectionHeading(section: SettingsSection) {
  switch (section) {
    case "general":
      return "Keep the desktop app consistent with the operating system";
    case "runtime":
      return "Keep one engine model across the desktop app";
    case "updates":
      return "Manage signed desktop releases from one place";
    case "shell":
      return "Use the same terminal integration flow everywhere";
    case "keyring":
      return "Keep credentials local with native OS storage";
    case "advanced":
      return "Move low-level runtime details out of the main preference flow";
  }
}

function sectionDescription(section: SettingsSection) {
  switch (section) {
    case "general":
      return "General preferences should feel like a Mac utility: clear defaults, system-driven appearance, and startup behavior that does not require reading implementation details.";
    case "runtime":
      return "The desktop app is designed around the bundled engine. Advanced overrides stay available, but the default path is the supported cross-platform experience.";
    case "updates":
      return "Choose the release track for this machine, save it once, then check and install signed desktop updates without leaving the app.";
    case "shell":
      return "Terminal integration follows the same copy-and-verify pattern across supported shells so the experience stays predictable for non-terminal users.";
    case "keyring":
      return "Security guidance, storage behavior, and recovery steps should feel consistent regardless of the operating system underneath.";
    case "advanced":
      return "Advanced details stay available for debugging and override workflows, but they should not dominate the default desktop settings experience.";
  }
}

function sectionPills(section: SettingsSection) {
  switch (section) {
    case "general":
      return ["System-driven", "Desktop-first", "Local control"];
    case "runtime":
      return ["Bundled default", "Cross-platform", "Advanced override"];
    case "updates":
      return ["Signed releases", "Stable or beta", "In-app install"];
    case "shell":
      return ["Optional setup", "Shell-aware", "Copy and verify"];
    case "keyring":
      return ["Credentials stay local", "Native storage", "Recovery guides"];
    case "advanced":
      return ["Raw paths", "Storage override", "Engine inventory"];
  }
}

function sourceListSummary(section: SettingsSection) {
  switch (section) {
    case "general":
      return "Appearance and startup behavior";
    case "runtime":
      return "Included engine and overrides";
    case "updates":
      return "Release channel and signed installs";
    case "shell":
      return "Terminal integration guidance";
    case "keyring":
      return "Credential storage and recovery";
    case "advanced":
      return "Raw paths and app data folder";
  }
}
