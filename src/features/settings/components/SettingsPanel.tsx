import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
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
  const [aiswHome, setAiswHome] = useState(settings.aisw_home ?? "");
  const [updateChannel, setUpdateChannel] = useState(settings.update_channel);
  const readEnabled = useMutationAwareQueryEnabled();
  const shellGuidance = useQuery({ queryKey: ["shell-guidance"], queryFn: getShellGuidance });
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor, enabled: readEnabled });
  const [selectedShell, setSelectedShell] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(
    initialSection ?? "runtime",
  );
  const runtimeRef = useRef<HTMLDivElement | null>(null);
  const updatesRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const keyringRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const target =
      selectedSection === "runtime"
        ? runtimeRef.current
        : selectedSection === "updates"
          ? updatesRef.current
          : selectedSection === "shell"
            ? shellRef.current
            : keyringRef.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [selectedSection]);

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
    <>
      <div ref={runtimeRef}>
        <SectionCard title="Settings" kicker="Runtime and home directory">
          <div className="button-row">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section}
                className={selectedSection === section ? "primary-button" : "ghost-button"}
                type="button"
                aria-pressed={selectedSection === section}
                onClick={() => setSelectedSection(section)}
              >
                {sectionLabel(section)}
              </button>
            ))}
          </div>
          <form className="stacked-form settings-form" onSubmit={submit}>
          <label>
            Runtime selection
            <select value={runtimeKind} onChange={(event) => setRuntimeKind(event.target.value as typeof runtimeKind)}>
              <option value="bundled">Bundled aisw</option>
              <option value="system">System aisw</option>
              <option value="custom">Custom path</option>
            </select>
          </label>
          <label>
            Runtime path
            <input
              value={runtimePath}
              disabled={runtimeKind !== "custom"}
              placeholder={runtimeKind === "custom" ? "/path/to/aisw" : "Only used for custom runtime"}
              onChange={(event) => setRuntimePath(event.target.value)}
            />
          </label>
          <label>
            AISW_HOME override
            <input value={aiswHome} onChange={(event) => setAiswHome(event.target.value)} />
          </label>
          <label>
            Update channel
            <select value={updateChannel} onChange={(event) => setUpdateChannel(event.target.value)}>
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </label>
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
          <div className="stack-list diagnostics-body">
            <article className="diagnostic-card">
              <h3>Runtime detection</h3>
              <p className="inline-note">
                Current resolved path: {runtimeStatus.resolved_path ?? "No aisw runtime resolved"}
              </p>
              <p className="inline-note">
                Effective AISW home: {settings.aisw_home ?? "~/.aisw"}
              </p>
              <p className="inline-note">
                Bundled aisw: {runtimeStatus.inventory.bundled_path ?? "Not available in this build"}
              </p>
              <p className="inline-note">
                System aisw: {runtimeStatus.inventory.system_path ?? "Not found on PATH"}
              </p>
              {runtimeStatus.inventory.configured_path ? (
                <p className="inline-note">
                  Configured custom path: {runtimeStatus.inventory.configured_path}
                </p>
              ) : null}
              <p className="inline-note">
                Selected update channel: <strong>{titleCase(updateChannel)}</strong>
              </p>
              <p className="inline-note">
                Selected backend: <strong>{titleCase(runtimeKind)}</strong>
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
            </article>
          </div>
        </SectionCard>
      </div>

      <div ref={updatesRef}>
        <SectionCard title="Desktop updates" kicker="Signed app releases">
          <div className="stack-list">
            <p className="inline-note">
              Check for a signed AISW Desktop release on the selected {updateChannel} channel.
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
                <p className="inline-note">Current app version: {checkForUpdatesMutation.data.current_version}</p>
                <p className="inline-note">Channel: {checkForUpdatesMutation.data.channel}</p>
                {checkForUpdatesMutation.data.endpoint ? (
                  <p className="inline-note">Endpoint: {checkForUpdatesMutation.data.endpoint}</p>
                ) : null}
                {checkForUpdatesMutation.data.update ? (
                  <>
                    <p className="inline-note">Update available: {checkForUpdatesMutation.data.update.version}</p>
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
            {checkForUpdatesMutation.error ? (
              <MutationErrorCard
                title="Update check failed"
                error={checkForUpdatesMutation.error}
              />
            ) : null}
            {installUpdateMutation.data ? (
              <p className="inline-note">
                {installUpdateMutation.data.message ??
                  (installUpdateMutation.data.installed_version
                    ? `Installed ${installUpdateMutation.data.installed_version}`
                    : "No update installed.")}
              </p>
            ) : null}
            {installUpdateMutation.error ? (
              <MutationErrorCard
                title="Update install failed"
                error={installUpdateMutation.error}
              />
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div ref={shellRef}>
        <SectionCard title="Shell hook" kicker="Explicit shell guidance">
          <div className="stack-list">
            <p className="inline-note">
              The shell hook is optional, but recommended when you want immediate environment exports
              in the current terminal session and workspace guardrails before agent launch.
            </p>
            {shellCheck ? (
              <p className={`diagnostic-status diagnostic-status-${shellCheck.status}`}>
                {shellCheck.status === "pass" ? "✓" : shellCheck.status === "warn" ? "!" : "✕"} Shell hook{" "}
                {shellCheck.status}
                {shellCheck.detail ? ` · ${shellCheck.detail}` : ""}
              </p>
            ) : (
              <p className="inline-note">Run diagnostics to verify whether the shell hook is active.</p>
            )}
            <p className="inline-note">
              Detected shell:{" "}
              <strong>{shellGuidance.data?.detected_shell ? titleCase(shellGuidance.data.detected_shell) : "Unknown"}</strong>
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
                  <select value={selectedVariant?.shell ?? ""} onChange={(event) => setSelectedShell(event.target.value)}>
                    {shellGuidance.data.variants.map((variant) => (
                      <option key={variant.shell} value={variant.shell}>
                        {variant.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="inline-note">{shellGuidance.isLoading ? "Loading shell guidance…" : "Shell guidance is unavailable."}</p>
            )}
            {selectedVariant ? (
              <article className="diagnostic-card">
                <h3>{selectedVariant.title}</h3>
                <p className="inline-note">Config file: {selectedVariant.config_path}</p>
                {selectedVariant.alternate_config_path ? (
                  <p className="inline-note">Alternative: {selectedVariant.alternate_config_path}</p>
                ) : null}
                <div className="stack-list">
                  <div>
                    <p className="inline-note">Install</p>
                    <pre>{selectedVariant.install_command}</pre>
                    <div className="button-row">
                      <button type="button" className="ghost-button" onClick={() => void copyText(selectedVariant.install_command, "install")}>
                        Copy install command
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="inline-note">Reload</p>
                    <pre>{selectedVariant.reload_command}</pre>
                    <div className="button-row">
                      <button type="button" className="ghost-button" onClick={() => void copyText(selectedVariant.reload_command, "reload")}>
                        Copy reload command
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="inline-note">Verify</p>
                    <pre>{selectedVariant.verify_command}</pre>
                    <p className="inline-note">Expected output: {selectedVariant.verify_expected}</p>
                    <div className="button-row">
                      <button type="button" className="ghost-button" onClick={() => void copyText(selectedVariant.verify_command, "verify")}>
                        Copy verify command
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}
            {shellGuidance.data ? (
              <article className="diagnostic-card">
                <h3>Without the hook</h3>
                <p className="inline-note">{shellGuidance.data.note}</p>
                {shellGuidance.data.manual_apply_examples.map((example) => (
                  <pre key={example}>{example}</pre>
                ))}
              </article>
            ) : null}
            {copyMessage ? <p className="inline-note">{copyMessage}</p> : null}
          </div>
        </SectionCard>
      </div>

      <div ref={keyringRef}>
        <SectionCard title="Keyring setup" kicker="Local credential backends">
          <div className="stack-list">
            <p className="inline-note">
              AISW Desktop keeps credentials on this machine. When diagnostics report a keyring
              failure, use the guidance below to restore the OS-native secret store before retrying.
            </p>

            {KEYRING_GUIDES.map((guide) => (
              <article key={guide.platform} className="diagnostic-card">
                <h3>{guide.title}</h3>
                <p className="inline-note">Expected backend: {guide.backend}</p>
                {guide.steps.map((step) => (
                  <p key={step} className="inline-note">
                    {step}
                  </p>
                ))}
                <p className="inline-note">Verify: {guide.verify}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

const KEYRING_GUIDES = [
  {
    platform: "macos",
    title: "macOS Keychain",
    backend: "Login keychain",
    steps: [
      "Open Keychain Access and confirm the login keychain is unlocked.",
      "Approve any keychain access prompts for AISW Desktop, Claude, Codex, or Gemini.",
      "If access keeps failing, lock and unlock the login keychain, then rerun diagnostics.",
    ],
    verify: "Rerun diagnostics and confirm the keyring warning disappears.",
  },
  {
    platform: "windows",
    title: "Windows Credential Manager",
    backend: "Credential Manager / DPAPI",
    steps: [
      "Stay signed in to a normal desktop session before launching AISW Desktop.",
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
      "Make sure the desktop session has an active D-Bus user session before launching AISW Desktop.",
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
      detail: check.detail ?? "",
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
      return "Runtime";
    case "updates":
      return "Updates";
    case "shell":
      return "Shell hook";
    case "keyring":
      return "Keyring setup";
  }
}
