import { FormEvent, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { AppSnapshot } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { useDesktopActions } from "../../shared/useDesktopActions";

const TOOLS = ["claude", "codex", "gemini"] as const;

export function ProfilesPanel({ snapshot }: { snapshot: AppSnapshot }) {
  const { addProfileMutation, useProfileMutation } = useDesktopActions();
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("claude");
  const [profile, setProfile] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"from_live" | "from_env" | "api_key">("from_live");
  const [apiKey, setApiKey] = useState("");

  const profiles = useMemo(() => snapshot.profiles[tool]?.profiles ?? [], [snapshot, tool]);

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
        stateMode: tool === "gemini" ? null : "isolated",
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
              </div>
              <button
                className="ghost-button"
                onClick={() =>
                  useProfileMutation.mutate({
                    tool,
                    profile: entry.name,
                    stateMode: tool === "gemini" ? null : "isolated",
                  })
                }
              >
                Activate
              </button>
            </article>
          ))}
          {!profiles.length ? <p className="inline-note">No profiles stored for this tool yet.</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}
