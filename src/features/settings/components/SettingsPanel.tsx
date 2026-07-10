import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { getShellGuidance, runDoctor } from "../../../lib/client";
import { DesktopCommandError } from "../../../lib/tauri";
import { DesktopSettings, AppBootstrap } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { useDesktopActions } from "../../shared/useDesktopActions";

export function SettingsPanel({
  settings,
  runtimeStatus,
}: {
  settings: DesktopSettings;
  runtimeStatus: AppBootstrap["runtime_status"];
}) {
  const { updateSettingsMutation, checkForUpdatesMutation, installUpdateMutation, mutationLock } =
    useDesktopActions();
  const [runtimeKind, setRuntimeKind] = useState(settings.runtime_kind);
  const [runtimePath, setRuntimePath] = useState(settings.runtime_path ?? "");
  const [aiswHome, setAiswHome] = useState(settings.aisw_home ?? "");
  const [updateChannel, setUpdateChannel] = useState(settings.update_channel);
  const shellGuidance = useQuery({ queryKey: ["shell-guidance"], queryFn: getShellGuidance });
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor });
  const [selectedShell, setSelectedShell] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const shellCheck = useMemo(() => findShellHookCheck(doctor.data), [doctor.data]);
  const selectedVariant = useMemo(() => {
    const variants = shellGuidance.data?.variants ?? [];
    if (!variants.length) return undefined;
    return variants.find((variant) => variant.shell === selectedShell) ?? variants[0];
  }, [selectedShell, shellGuidance.data]);
  const hasPendingSettingsChanges =
    runtimeKind !== settings.runtime_kind ||
    runtimePath !== (settings.runtime_path ?? "") ||
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSettingsMutation.mutate({
      runtime_kind: runtimeKind,
      runtime_path: runtimePath || null,
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
      <SectionCard title="Settings" kicker="Runtime and home directory">
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
            <input value={runtimePath} onChange={(event) => setRuntimePath(event.target.value)} />
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
              Selected backend: <strong>{titleCase(runtimeKind)}</strong>
            </p>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Desktop updates" kicker="Signed app releases">
        <div className="stack-list">
          <p className="inline-note">
            Check for a signed AISW Desktop release on the selected {settings.update_channel} channel.
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
    </>
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
