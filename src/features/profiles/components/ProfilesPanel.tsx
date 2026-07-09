import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import {
  AppBootstrap,
  AppSnapshot,
  DesktopSettings,
  type OAuthProgressEvent,
} from "../../../lib/schemas";
import { DesktopCommandError } from "../../../lib/tauri";
import { listenDesktopEvent } from "../../../lib/tauri";
import { listBackups, parseOAuthProgressEvent } from "../../../lib/client";
import { titleCase } from "../../../lib/utils";
import { useDesktopActions } from "../../shared/useDesktopActions";

const TOOLS = ["claude", "codex", "gemini"] as const;

export function ProfilesPanel({
  snapshot,
  settings,
  toolCapabilities,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
}) {
  const {
    addProfileMutation,
    addProfileOAuthMutation,
    useProfileMutation,
    renameProfileMutation,
    removeProfileMutation,
    restoreBackupMutation,
    updateSettingsMutation,
    apiKeyProfileAction,
    mutationLock,
  } = useDesktopActions();
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("claude");
  const [profile, setProfile] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"from_live" | "from_env" | "api_key" | "oauth">("from_live");
  const [stateMode, setStateMode] = useState("isolated");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [oauthEvents, setOauthEvents] = useState<OAuthProgressEvent[]>([]);
  const [oauthError, setOauthError] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);

  const profiles = useMemo(() => snapshot.profiles[tool]?.profiles ?? [], [snapshot, tool]);
  const toolStatus = useMemo(
    () => snapshot.statuses.find((entry) => entry.tool === tool),
    [snapshot.statuses, tool],
  );
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups });
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

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenDesktopEvent<unknown>("oauth-progress", (payload) => {
      if (!active) return;
      const event = parseOAuthProgressEvent(payload);
      setOauthEvents((current) => [...current, event]);
    }).then((dispose) => {
      unlisten = typeof dispose === "function" ? dispose : undefined;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.trim()) {
      return;
    }

    const nextStateMode = availableStateModes.length ? stateMode : null;

    if (mode === "oauth") {
      setOauthEvents([]);
      setOauthError("");
      addProfileOAuthMutation.mutate(
        {
          tool,
          profile,
          label: label || null,
          stateMode: nextStateMode,
        },
        {
          onSuccess: () => {
            setProfile("");
            setLabel("");
          },
          onError: (error) => {
            setOauthError(formatDesktopError(error));
          },
        },
      );
      return;
    }

    if (mode === "api_key") {
      const apiKey = apiKeyInputRef.current?.value ?? "";
      void apiKeyProfileAction
        .submit({
          tool,
          profile,
          label: label || null,
          stateMode: availableStateModes.length ? stateMode : null,
          importMode: { kind: "api_key", value: apiKey },
        })
        .then(() => {
          setProfile("");
          setLabel("");
          if (apiKeyInputRef.current) {
            apiKeyInputRef.current.value = "";
          }
        })
        .catch(() => undefined);
      return;
    }

    const importMode =
      mode === "from_env"
        ? { kind: "from_env" as const }
        : { kind: "from_live" as const };

    addProfileMutation.mutate({
      tool,
      profile,
      label: label || null,
      stateMode: availableStateModes.length ? stateMode : null,
      importMode,
    });
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
              <option value="oauth">Guided OAuth capture</option>
            </select>
          </label>
          {mode === "api_key" ? (
            <label>
              API key
              <input
                ref={apiKeyInputRef}
                type="password"
                autoComplete="off"
                onChange={() => {
                  if (apiKeyProfileAction.error) {
                    apiKeyProfileAction.clearError();
                  }
                }}
              />
            </label>
          ) : null}
          {mode === "from_env" ? (
            <p className="inline-note">
              Expected environment variable: <code>{expectedEnvVar(tool)}</code>
            </p>
          ) : null}
          {mode === "oauth" ? (
            <div className="diagnostic-card">
              <h3>OAuth wizard</h3>
              <p className="inline-note">
                AISW Desktop will launch the tool&apos;s native login flow and stream progress from
                <code> aisw add {tool} {profile || "<profile>"} --progress-json</code>.
              </p>
              <p className="inline-note">
                Keep this window open while the browser or terminal login completes.
              </p>
            </div>
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
          <button
            className="primary-button"
            type="submit"
            disabled={
              mutationLock.isBusy ||
              addProfileMutation.isPending ||
              addProfileOAuthMutation.isPending ||
              apiKeyProfileAction.isPending
            }
          >
            {mode === "oauth"
              ? addProfileOAuthMutation.isPending
                ? "Waiting for OAuth…"
                : "Start OAuth"
              : mode === "api_key"
                ? apiKeyProfileAction.isPending
                  ? "Saving…"
                  : "Add profile"
                : addProfileMutation.isPending
                ? "Saving…"
                : "Add profile"}
          </button>
          {profileMutationError(
            addProfileMutation.error,
            addProfileOAuthMutation.error,
            renameProfileMutation.error,
            removeProfileMutation.error,
            useProfileMutation.error,
            apiKeyProfileAction.error,
          ) ? (
            <p className="inline-note">
              {profileMutationError(
                addProfileMutation.error,
                addProfileOAuthMutation.error,
                renameProfileMutation.error,
                removeProfileMutation.error,
                useProfileMutation.error,
                apiKeyProfileAction.error,
              )}
            </p>
          ) : null}
        </form>
        <div className="stack-list">
          {mode === "oauth" ? (
            <article className="diagnostic-card">
              <h3>OAuth progress</h3>
              {oauthEvents.length ? (
                <div className="stack-list">
                  {oauthEvents.map((event, index) => (
                    <div key={`${event.seq ?? index}-${event.phase ?? event.type ?? "event"}`}>
                      <p className="diagnostic-status">
                        {formatOauthStep(event)}
                      </p>
                      {event.message ? <p className="inline-note">{event.message}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="inline-note">
                  Start OAuth to stream steps such as browser launch, waiting for login, and profile save.
                </p>
              )}
              {oauthError ? <p className="inline-note">{oauthError}</p> : null}
            </article>
          ) : null}
          {profiles.map((entry) => {
            const latestBackup = latestBackupForProfile(tool, entry.name, backups.data);
            return (
            <article key={entry.name} className="list-row">
              <div>
                <strong>{effectiveLabel(tool, entry.name, entry.label, settings) ?? entry.name}</strong>
                <p>
                  {entry.name} · {entry.auth}
                </p>
                <p className="inline-note">
                  Active: {snapshot.profiles[tool]?.active === entry.name ? "yes" : "no"}
                  {snapshot.profiles[tool]?.active === entry.name && toolStatus?.credential_backend
                    ? ` · Backend: ${toolStatus.credential_backend}`
                    : ""}
                  {snapshot.profiles[tool]?.active === entry.name &&
                  toolStatus?.active_profile_applied === false
                    ? " · Live mismatch detected"
                    : ""}
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
                    disabled={mutationLock.isBusy}
                    onClick={() => {
                      const newName = renameDrafts[entry.name]?.trim();
                      if (!newName) return;
                      setPendingRemoval(null);
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
                <div className="inline-form inline-form-compact">
                  <input
                    aria-label={`label ${entry.name}`}
                    placeholder="display label"
                    value={labelDrafts[entry.name] ?? effectiveLabel(tool, entry.name, entry.label, settings) ?? ""}
                    onChange={(event) =>
                      setLabelDrafts((current) => ({
                        ...current,
                        [entry.name]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => {
                      const nextLabel = labelDrafts[entry.name]?.trim() ?? "";
                      setPendingRemoval(null);
                      updateSettingsMutation.mutate({
                        runtime_kind: settings.runtime_kind,
                        runtime_path: settings.runtime_path ?? null,
                        aisw_home: settings.aisw_home ?? null,
                        update_channel: settings.update_channel,
                        profile_sets: settings.profile_sets,
                        profile_labels: mergeProfileLabel(settings, tool, entry.name, nextLabel || null),
                      });
                    }}
                  >
                    Relabel
                  </button>
                </div>
                {expandedDetails === entry.name ? (
                  <article className="diagnostic-card">
                    <h4>Diagnostic details</h4>
                    <p className="inline-note">
                      Credential backend: {toolStatus?.credential_backend ?? "unknown"}
                    </p>
                    <p className="inline-note">
                      Live match:{" "}
                      {toolStatus?.active_profile_applied === undefined ||
                      toolStatus?.active_profile_applied === null
                        ? "unknown"
                        : toolStatus.active_profile_applied
                          ? "yes"
                          : "no"}
                    </p>
                    <p className="inline-note">
                      Credentials present:{" "}
                      {toolStatus?.credentials_present === undefined ||
                      toolStatus?.credentials_present === null
                        ? "unknown"
                        : toolStatus.credentials_present
                          ? "yes"
                          : "no"}
                    </p>
                    <p className="inline-note">
                      Permissions OK:{" "}
                      {toolStatus?.permissions_ok === undefined || toolStatus?.permissions_ok === null
                        ? "unknown"
                        : toolStatus.permissions_ok
                          ? "yes"
                          : "no"}
                    </p>
                    {toolStatus?.token_warning ? (
                      <p className="inline-note">
                        Token warning: {formatProfileTokenWarning(toolStatus)}
                      </p>
                    ) : null}
                    {toolStatus?.warnings.length ? (
                      <div className="stack-list">
                        {toolStatus.warnings.map((warning, index) => (
                          <p
                            key={`${warning.code ?? warning.message ?? "warning"}-${index}`}
                            className="inline-note"
                          >
                            Warning: {formatProfileWarning(warning)}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {!toolStatus?.token_warning && !toolStatus?.warnings.length ? (
                      <p className="inline-note">
                        No additional token or runtime warnings are currently reported for this tool.
                      </p>
                    ) : null}
                  </article>
                ) : null}
              </div>
              <div className="button-row button-row-column">
                <button
                  className="ghost-button"
                  disabled={mutationLock.isBusy}
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
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setExpandedDetails((current) => (current === entry.name ? null : entry.name))
                  }
                >
                  {expandedDetails === entry.name ? "Hide diagnostic details" : "View diagnostic details"}
                </button>
                {latestBackup ? (
                  <>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() => restoreBackupMutation.mutate(latestBackup.backup_id)}
                    >
                      Restore latest
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() => {
                        restoreBackupMutation.mutate(latestBackup.backup_id, {
                          onSuccess: () => {
                            useProfileMutation.mutate({
                              tool,
                              profile: entry.name,
                              stateMode: tool === "gemini" ? null : "isolated",
                            });
                          },
                        });
                      }}
                    >
                      Restore latest + activate
                    </button>
                  </>
                ) : null}
                {snapshot.profiles[tool]?.active === entry.name ? (
                  pendingRemoval === entry.name ? (
                    <>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => {
                          setPendingRemoval(null);
                          removeProfileMutation.mutate({
                            tool,
                            profile: entry.name,
                            force: true,
                          });
                        }}
                      >
                        Confirm remove active
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setPendingRemoval(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      onClick={() => setPendingRemoval(entry.name)}
                    >
                      Remove active…
                    </button>
                  )
                ) : (
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => {
                      setPendingRemoval(null);
                      removeProfileMutation.mutate({
                        tool,
                        profile: entry.name,
                        force: false,
                      });
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
            );
          })}
          {!profiles.length ? <p className="inline-note">No profiles stored for this tool yet.</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function effectiveLabel(
  tool: string,
  profile: string,
  currentLabel: string | null | undefined,
  settings: DesktopSettings,
) {
  const override = settings.profile_labels?.[tool]?.[profile];
  return override ?? currentLabel ?? null;
}

function mergeProfileLabel(
  settings: DesktopSettings,
  tool: string,
  profile: string,
  label: string | null,
) {
  const next = {
    ...(settings.profile_labels ?? {}),
    [tool]: {
      ...(settings.profile_labels?.[tool] ?? {}),
      [profile]: label,
    },
  };

  if (label === null && Object.values(next[tool]).every((value) => value == null)) {
    delete next[tool];
  }

  return next;
}

function latestBackupForProfile(
  tool: string,
  profile: string,
  backups: Array<{ backup_id: string; tool: string; profile: string }> | undefined,
) {
  return backups?.find(
    (entry) =>
      entry.tool === tool &&
      (entry.profile === profile || entry.profile === `${tool}/${profile}`),
  );
}

function expectedEnvVar(tool: string) {
  switch (tool) {
    case "claude":
      return "ANTHROPIC_API_KEY";
    case "codex":
      return "OPENAI_API_KEY";
    case "gemini":
      return "GEMINI_API_KEY";
    default:
      return "API_KEY";
  }
}

function formatOauthStep(event: OAuthProgressEvent) {
  const phase = event.phase ?? event.type ?? "progress";
  switch (phase) {
    case "starting_upstream_auth":
      return "1. Starting upstream login";
    case "waiting_for_user":
      return "2. Waiting for login completion";
    case "applying_changes":
      return "3. Saving captured profile";
    case "result":
      return event.ok ? "4. Profile saved" : "4. OAuth failed";
    case "started":
      return "0. Starting OAuth";
    default:
      return titleCase(phase.replace(/_/g, " "));
  }
}

function profileMutationError(...errors: Array<unknown>) {
  for (const error of errors) {
    if (!error) continue;
    return formatDesktopError(error);
  }
  return "";
}

function formatDesktopError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return error.remediation ? `${error.message} Remediation: ${error.remediation}` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    const remediation =
      "remediation" in error && typeof error.remediation === "string" ? error.remediation : undefined;
    return remediation ? `${error.message} Remediation: ${remediation}` : error.message;
  }
  return "Desktop command failed.";
}

function formatProfileTokenWarning(
  status: NonNullable<AppSnapshot["statuses"][number]>,
) {
  const warning = status.token_warning;
  if (!warning) {
    return "Token state needs attention.";
  }
  const detail = warning.summary ?? warning.message ?? warning.code ?? "Token state needs attention.";
  const suffix = warning.expires_at
    ? ` Expires at ${warning.expires_at}.`
    : typeof warning.expires_in_days === "number"
      ? ` Expires in ${warning.expires_in_days} days.`
      : "";
  return `${detail}${suffix}`;
}

function formatProfileWarning(
  warning: NonNullable<AppSnapshot["statuses"][number]["warnings"]>[number],
) {
  const detail = warning.message ?? warning.code ?? "Warning reported by aisw.";
  return warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;
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
