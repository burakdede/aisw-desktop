import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { getShellGuidance, runDoctor } from "../../../lib/client";
import { DesktopCommandError } from "../../../lib/tauri";
import { DesktopSettings, AppBootstrap } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";

export const SETTINGS_SECTIONS = ["runtime", "updates", "shell", "keyring"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function SettingsPanel({
  settings,
  runtimeStatus,
  initialSection,
}: {
  settings: DesktopSettings;
  runtimeStatus: AppBootstrap["runtime_status"];
  initialSection?: SettingsSection;
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
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(
    initialSection ?? "runtime",
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
    setSelectedSection(initialSection ?? "runtime");
  }, [initialSection]);

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

  return (
    <SectionCard title="Settings" kicker={sectionKicker(selectedSection)}>
      <article className="desktop-pane-hero settings-hero">
        <div className="desktop-pane-hero-copy">
          <p className="card-kicker">Preferences</p>
          <h3>{sectionHeading(selectedSection)}</h3>
          <p className="inline-note">{sectionDescription(selectedSection)}</p>
        </div>
        <div className="desktop-pane-hero-pills settings-hero-pills">
          {sectionPills(selectedSection).map((pill) => (
            <span key={pill} className="status-pill">
              {pill}
            </span>
          ))}
        </div>
      </article>
      <SegmentedControl
        ariaLabel="Settings sections"
        className="settings-nav"
        kind="tabs"
        options={SETTINGS_SECTIONS.map((section) => ({
          value: section,
          label: sectionLabel(section),
        }))}
        value={selectedSection}
        onChange={setSelectedSection}
      />
      <div className="settings-pane">
        {selectedSection === "runtime" ? (
          <div className="panel-grid panel-grid-2 settings-layout">
            <form className="stacked-form settings-form" onSubmit={submit}>
              <article className="diagnostic-card settings-pane-intro">
                <h3>Preferred setup</h3>
                <p className="inline-note">
                  Keep the desktop app on its bundled runtime unless you intentionally need an advanced override.
                </p>
              </article>
              <article
                className={`diagnostic-card ${runtimeKind === "bundled" ? "diagnostic-pass" : "diagnostic-warn"}`}
              >
                <h3>Recommended runtime</h3>
                <p className="inline-note">
                  This app ships with a compatible runtime and uses it by default.
                </p>
                <p className="inline-note">
                  Use a system or custom runtime only when you intentionally need to override the supported desktop bundle.
                </p>
              </article>

              {runtimeKind !== "bundled" ? (
                <article className="diagnostic-card diagnostic-warn">
                  <h3>Advanced runtime override is active</h3>
                  <p className="inline-note">
                    This desktop session is using a{" "}
                    {runtimeKind === "system" ? "system" : "custom"} runtime binary instead of the bundled runtime.
                  </p>
                  <p className="inline-note">
                    Compatibility for onboarding, switching, and diagnostics is only guaranteed with the bundled runtime shipped in this app release.
                  </p>
                </article>
              ) : null}

              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Engine</p>
                    <h3>Runtime source</h3>
                  </div>
                  <p className="inline-note">
                    Keep the bundled runtime selected unless you intentionally need a compatibility override.
                  </p>
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
                        <option value="bundled">Bundled runtime</option>
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
                            ? "/path/to/engine"
                            : "Only used for a custom runtime"
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
                          Hide advanced runtime options
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
                      Show advanced runtime options
                    </button>
                  </div>
                )}
              </article>

              <article className="diagnostic-card settings-pane-section">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Storage</p>
                    <h3>App data folder</h3>
                  </div>
                  <p className="inline-note">
                    Leave this empty to use the default desktop storage location.
                  </p>
                </div>
                <label>
                  App data folder override
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
                    <h3>Runtime details</h3>
                  </div>
                  <p className="inline-note">
                    Review the selected engine mode and storage state. Raw paths stay in the advanced runtime view.
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
                  App data folder:{" "}
                  {settings.aisw_home ? `Custom folder (${settings.aisw_home})` : "Managed automatically"}
                </p>
                <p className="inline-note">
                  Compatibility:{" "}
                  <strong>{runtimeStatus.compatible ? "Ready for desktop switching" : "Needs attention"}</strong>
                </p>
                <p className="inline-note">
                  Runtime mode: <strong>{titleCase(runtimeKind)}</strong>
                </p>
                <p className="inline-note">
                  Selected update channel: <strong>{titleCase(updateChannel)}</strong>
                </p>
                <p className="inline-note">
                  Runtime version: {runtimeStatus.version?.version ?? "unknown"}
                </p>
                {runtimeStatus.version ? (
                  <p className="inline-note">
                    CLI API {runtimeStatus.version.cli_api_version} · JSON schema{" "}
                    {runtimeStatus.version.json_schema_version} · Progress schema{" "}
                    {runtimeStatus.version.progress_schema_version}
                  </p>
                ) : null}
                {showAdvancedRuntime || runtimeKind !== "bundled" ? (
                  <>
                    <p className="inline-note">
                      Active engine path: {runtimeStatus.resolved_path ?? "No runtime resolved"}
                    </p>
                    <p className="inline-note">
                      Included engine path:{" "}
                      {runtimeStatus.inventory.bundled_path ?? "Not available in this build"}
                    </p>
                    <p className="inline-note">
                      System engine candidate:{" "}
                      {runtimeStatus.inventory.system_path ?? "Not found on PATH"}
                    </p>
                  </>
                ) : null}
                {runtimeStatus.inventory.configured_path && (showAdvancedRuntime || runtimeKind !== "bundled") ? (
                  <p className="inline-note">
                    Custom engine path: {runtimeStatus.inventory.configured_path}
                  </p>
                ) : null}
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
                    Review the security model before changing credential or runtime settings.
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
      </div>
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
    case "runtime":
      return "Engine";
    case "updates":
      return "Updates";
    case "shell":
      return "Terminal Integration";
    case "keyring":
      return "Security";
  }
}

function sectionKicker(section: SettingsSection) {
  switch (section) {
    case "runtime":
      return "Engine and local storage";
    case "updates":
      return "Signed desktop releases";
    case "shell":
      return "Shell setup and current-session switching";
    case "keyring":
      return "Local credential storage and recovery";
  }
}

function sectionHeading(section: SettingsSection) {
  switch (section) {
    case "runtime":
      return "Keep one engine model across the desktop app";
    case "updates":
      return "Manage signed desktop releases from one place";
    case "shell":
      return "Use the same terminal integration flow everywhere";
    case "keyring":
      return "Keep credentials local with native OS storage";
  }
}

function sectionDescription(section: SettingsSection) {
  switch (section) {
    case "runtime":
      return "The desktop app is designed around the bundled engine. Advanced overrides stay available, but the default path is the supported cross-platform experience.";
    case "updates":
      return "Choose the release track for this machine, save it once, then check and install signed desktop updates without leaving the app.";
    case "shell":
      return "Terminal integration follows the same copy-and-verify pattern across supported shells so the experience stays predictable for non-terminal users.";
    case "keyring":
      return "Security guidance, storage behavior, and recovery steps should feel consistent regardless of the operating system underneath.";
  }
}

function sectionPills(section: SettingsSection) {
  switch (section) {
    case "runtime":
      return ["Bundled default", "Cross-platform", "Advanced override"];
    case "updates":
      return ["Signed releases", "Stable or beta", "In-app install"];
    case "shell":
      return ["Optional setup", "Shell-aware", "Copy and verify"];
    case "keyring":
      return ["Credentials stay local", "Native storage", "Recovery guides"];
  }
}
