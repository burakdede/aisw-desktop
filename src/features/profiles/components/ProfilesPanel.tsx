import { FormEvent, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { AppBootstrap, AppSnapshot } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { useDesktopActions } from "../../shared/useDesktopActions";

const TOOLS = ["claude", "codex", "gemini"] as const;

export function ProfilesPanel({
  snapshot,
  toolCapabilities,
}: {
  snapshot: AppSnapshot;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
}) {
  const {
    addProfileMutation,
    useProfileMutation,
    renameProfileMutation,
    removeProfileMutation,
  } = useDesktopActions();
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("claude");
  const [profile, setProfile] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"from_live" | "from_env" | "api_key">("from_live");
  const [apiKey, setApiKey] = useState("");
  const [stateMode, setStateMode] = useState("isolated");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const profiles = useMemo(() => snapshot.profiles[tool]?.profiles ?? [], [snapshot, tool]);
  const availableStateModes = useMemo(
    () => supportedStateModes(tool, toolCapabilities),
    [tool, toolCapabilities],
  );

  useEffect(() => {
    if (!availableStateModes.length) {
      return;
    }
    if (!availableStateModes.includes(stateMode)) {
      setStateMode(availableStateModes[0]);
    }
  }, [availableStateModes, stateMode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.trim()) {
      return;
    }

    const importMode =
      mode === "api_key"
        ? { kind: "api_key" as const, value: apiKey }
        : mode === "from_env"
          ? { kind: "from_env" as const }
          : { kind: "from_live" as const };

    addProfileMutation.mutate(
      {
        tool,
        profile,
        label: label || null,
        stateMode: availableStateModes.length ? stateMode : null,
        importMode,
      },
      {
        onSuccess: () => {
          setProfile("");
          setLabel("");
          setApiKey("");
        },
      },
    );
  }

  return (
    <SectionCard title="Profiles" kicker="Provisioning">
      <div className="panel-grid panel-grid-2">
        <form className="stacked-form" onSubmit={submit}>
          <label>
            Tool
            <select value={tool} onChange={(event) => setTool(event.target.value as typeof tool)}>
              {TOOLS.map((entry) => (
                <option key={entry} value={entry}>
                  {titleCase(entry)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Profile name
            <input value={profile} onChange={(event) => setProfile(event.target.value)} />
          </label>
          <label>
            Label
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            Import mode
            <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="from_live">Import current login</option>
              <option value="from_env">Capture environment</option>
              <option value="api_key">API key via stdin</option>
            </select>
          </label>
          {mode === "api_key" ? (
            <label>
              API key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            State mode
            <select
              value={availableStateModes.length ? stateMode : "n/a"}
              onChange={(event) => setStateMode(event.target.value)}
              disabled={!availableStateModes.length}
            >
              {!availableStateModes.length ? <option value="n/a">Not configurable</option> : null}
              {availableStateModes.map((entry) => (
                <option key={entry} value={entry}>
                  {titleCase(entry)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={addProfileMutation.isPending}>
            {addProfileMutation.isPending ? "Saving…" : "Add profile"}
          </button>
        </form>
        <div className="stack-list">
          {profiles.map((entry) => (
            <article key={entry.name} className="list-row">
              <div>
                <strong>{entry.label ?? entry.name}</strong>
                <p>
                  {entry.name} · {entry.auth}
                </p>
                <div className="inline-form inline-form-compact">
                  <input
                    aria-label={`rename ${entry.name}`}
                    placeholder="new name"
                    value={renameDrafts[entry.name] ?? ""}
                    onChange={(event) =>
                      setRenameDrafts((current) => ({
                        ...current,
                        [entry.name]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      const newName = renameDrafts[entry.name]?.trim();
                      if (!newName) return;
                      renameProfileMutation.mutate({
                        tool,
                        oldName: entry.name,
                        newName,
                      });
                    }}
                  >
                    Rename
                  </button>
                </div>
              </div>
              <div className="button-row button-row-column">
                <button
                  className="ghost-button"
                  onClick={() =>
                    useProfileMutation.mutate({
                      tool,
                      profile: entry.name,
                      stateMode: availableStateModes.length ? stateMode : null,
                    })
                  }
                >
                  Activate
                </button>
                <button
                  className="ghost-button danger-button"
                  type="button"
                  onClick={() =>
                    removeProfileMutation.mutate({
                      tool,
                      profile: entry.name,
                      force: true,
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
          {!profiles.length ? <p className="inline-note">No profiles stored for this tool yet.</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function supportedStateModes(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  const configured = toolCapabilities[tool]?.state_modes ?? [];
  if (configured.length) {
    return configured;
  }
  return tool === "gemini" ? [] : ["isolated", "shared"];
}
