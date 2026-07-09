import { FormEvent, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { DesktopSettings } from "../../../lib/schemas";
import { useDesktopActions } from "../../shared/useDesktopActions";

export function SettingsPanel({ settings }: { settings: DesktopSettings }) {
  const { updateSettingsMutation, checkForUpdatesMutation, installUpdateMutation } = useDesktopActions();
  const [runtimeKind, setRuntimeKind] = useState(settings.runtime_kind);
  const [runtimePath, setRuntimePath] = useState(settings.runtime_path ?? "");
  const [aiswHome, setAiswHome] = useState(settings.aisw_home ?? "");
  const [updateChannel, setUpdateChannel] = useState(settings.update_channel);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSettingsMutation.mutate({
      runtime_kind: runtimeKind,
      runtime_path: runtimePath || null,
      aisw_home: aiswHome || null,
      update_channel: updateChannel,
      profile_sets: settings.profile_sets,
    });
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
          <button className="primary-button" type="submit" disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? "Saving…" : "Save settings"}
          </button>
        </form>
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
              disabled={checkForUpdatesMutation.isPending}
              onClick={() => checkForUpdatesMutation.mutate()}
            >
              {checkForUpdatesMutation.isPending ? "Checking…" : "Check for updates"}
            </button>
            <button
              type="button"
              disabled={installUpdateMutation.isPending || !checkForUpdatesMutation.data?.update}
              onClick={() => installUpdateMutation.mutate()}
            >
              {installUpdateMutation.isPending ? "Installing…" : "Install update"}
            </button>
          </div>
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
          {installUpdateMutation.data ? (
            <p className="inline-note">
              {installUpdateMutation.data.message ??
                (installUpdateMutation.data.installed_version
                  ? `Installed ${installUpdateMutation.data.installed_version}`
                  : "No update installed.")}
            </p>
          ) : null}
        </div>
      </SectionCard>
    </>
  );
}
