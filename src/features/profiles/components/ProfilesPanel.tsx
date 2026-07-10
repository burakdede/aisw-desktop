import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import {
  AppBootstrap,
  AppSnapshot,
  DesktopSettings,
  type OAuthProgressEvent,
} from "../../../lib/schemas";
import { compareBackupsNewestFirst } from "../../../lib/backups";
import { DesktopCommandError } from "../../../lib/tauri";
import { listenDesktopEvent } from "../../../lib/tauri";
import { listBackups, parseOAuthProgressEvent } from "../../../lib/client";
import { titleCase } from "../../../lib/utils";
import { resolveStateModeRequest, supportedStateModes } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { StateModeField } from "../../shared/components/StateModeField";

const TOOLS = ["claude", "codex", "gemini"] as const;

export function ProfilesPanel({
  snapshot,
  settings,
  toolCapabilities,
  initialTool,
  initialExpandedProfile,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  initialTool?: string;
  initialExpandedProfile?: string | null;
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
  const [tool, setTool] = useState<(typeof TOOLS)[number]>(
    isSupportedTool(initialTool) ? initialTool : "claude",
  );
  const [profile, setProfile] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"from_live" | "from_env" | "api_key" | "oauth">("from_live");
  const [stateMode, setStateMode] = useState("isolated");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [oauthEvents, setOauthEvents] = useState<OAuthProgressEvent[]>([]);
  const [oauthError, setOauthError] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    profile: string;
    mode: "files" | "activate";
  } | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);

  const profiles = useMemo(() => snapshot.profiles[tool]?.profiles ?? [], [snapshot, tool]);
  const normalizedProfileNames = useMemo(
    () => new Set(profiles.map((entry) => entry.name.trim().toLowerCase())),
    [profiles],
  );
  const toolStatus = useMemo(
    () => snapshot.statuses.find((entry) => entry.tool === tool),
    [snapshot.statuses, tool],
  );
  const readEnabled = useMutationAwareQueryEnabled();
  const backups = useQuery({ queryKey: ["backups"], queryFn: listBackups, enabled: readEnabled });
  const availableStateModes = useMemo(
    () => supportedStateModes(tool, toolCapabilities),
    [tool, toolCapabilities],
  );
  const duplicateDraftName = profile.trim();
  const hasDuplicateProfileName =
    duplicateDraftName.length > 0 && normalizedProfileNames.has(duplicateDraftName.toLowerCase());
  const oauthWizardSteps = useMemo(
    () => buildOauthWizardSteps(tool, oauthEvents, oauthError),
    [tool, oauthEvents, oauthError],
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
    if (!isSupportedTool(initialTool)) {
      return;
    }
    setTool(initialTool);
  }, [initialTool]);

  useEffect(() => {
    setExpandedDetails(initialExpandedProfile ?? null);
  }, [initialExpandedProfile, tool]);

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
    if (!profile.trim() || hasDuplicateProfileName) {
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
      if (apiKeyInputRef.current) {
        apiKeyInputRef.current.value = "";
      }
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
          {hasDuplicateProfileName ? (
            <p className="inline-note">
              {duplicateWarning(tool, duplicateDraftName)}
            </p>
          ) : null}
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
          {availableStateModes.length ? (
            <StateModeField
              name={`profile-state-mode-${tool}`}
              value={stateMode}
              options={availableStateModes}
              onChange={setStateMode}
            />
          ) : (
            <label>
              State mode
              <select value="n/a" disabled>
                <option value="n/a">Not configurable</option>
              </select>
            </label>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={
              mutationLock.isBusy ||
              addProfileMutation.isPending ||
              addProfileOAuthMutation.isPending ||
              apiKeyProfileAction.isPending ||
              hasDuplicateProfileName
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
              {oauthWizardSteps.some((step) => step.status !== "pending") ? (
                <div className="stack-list">
                  {oauthWizardSteps.map((step) => (
                    <div key={step.id}>
                      <p className={`diagnostic-status diagnostic-status-${step.status}`}>
                        {step.label}
                      </p>
                      <p className="inline-note">{step.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="inline-note">
                  Start OAuth to stream each login step before the profile is captured and saved.
                </p>
              )}
              {oauthError ? <p className="inline-note">{oauthError}</p> : null}
            </article>
          ) : null}
          {profiles.map((entry) => {
            const latestBackup = latestBackupForProfile(tool, entry.name, backups.data);
            const renameDraft = renameDrafts[entry.name] ?? "";
            const renameDuplicate =
              renameDraft.trim().length > 0 &&
              isDuplicateProfileName(profiles, entry.name, renameDraft);
            const isPendingRestoreFiles =
              pendingRestore?.profile === entry.name && pendingRestore.mode === "files";
            const isPendingRestoreAndActivate =
              pendingRestore?.profile === entry.name && pendingRestore.mode === "activate";
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
                    value={renameDraft}
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
                    disabled={mutationLock.isBusy || renameDuplicate}
                    onClick={() => {
                      const newName = renameDraft.trim();
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
                {renameDuplicate ? (
                  <p className="inline-note">
                    {duplicateWarning(tool, renameDraft.trim())}
                  </p>
                ) : null}
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
                      onClick={() =>
                        setPendingRestore({
                          profile: entry.name,
                          mode: "files",
                        })
                      }
                    >
                      Restore latest
                    </button>
                    {isPendingRestoreFiles ? (
                      <>
                        <button
                          className="ghost-button danger-button"
                          type="button"
                          disabled={mutationLock.isBusy}
                          onClick={() =>
                            restoreBackupMutation.mutate(latestBackup.backup_id, {
                              onSuccess: () => setPendingRestore(null),
                            })
                          }
                        >
                          Confirm restore latest
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setPendingRestore(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : isPendingRestoreAndActivate ? (
                      <>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={mutationLock.isBusy}
                          onClick={() =>
                            restoreBackupMutation.mutate(latestBackup.backup_id, {
                              onSuccess: () => {
                                setPendingRestore(null);
                                useProfileMutation.mutate({
                                  tool,
                                  profile: entry.name,
                                  stateMode: resolveStateModeRequest(tool, toolCapabilities, stateMode),
                                });
                              },
                            })
                          }
                        >
                          Confirm restore latest and activate
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setPendingRestore(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          setPendingRestore({
                            profile: entry.name,
                            mode: "activate",
                          })
                        }
                      >
                        Restore latest + activate
                      </button>
                    )}
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
              {isPendingRestoreFiles ? (
                <p className="inline-note">
                  Confirm before restoring the latest backup for {tool} / {entry.name}. This replays the saved files only.
                </p>
              ) : null}
              {isPendingRestoreAndActivate ? (
                <p className="inline-note">
                  Confirm before restoring and activating the latest backup for {tool} / {entry.name}. This replays the backup and switches the live profile again.
                </p>
              ) : null}
            </article>
            );
          })}
          {!profiles.length ? <p className="inline-note">No profiles stored for this tool yet.</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function isSupportedTool(tool: string | undefined): tool is (typeof TOOLS)[number] {
  return Boolean(tool && TOOLS.includes(tool as (typeof TOOLS)[number]));
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
  backups: Array<{ backup_id: string; tool: string; profile: string; created_at?: string | null }> | undefined,
) {
  return [...(backups ?? [])]
    .filter(
      (entry) =>
        entry.tool === tool &&
        (entry.profile === profile || entry.profile === `${tool}/${profile}`),
    )
    .sort(compareBackupsNewestFirst)[0];
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

type OAuthWizardStep = {
  id: "start" | "browser" | "login" | "capture" | "saved";
  label: string;
  detail: string;
  status: "pending" | "warn" | "pass" | "fail";
};

function buildOauthWizardSteps(
  tool: string,
  events: OAuthProgressEvent[],
  oauthError: string,
): OAuthWizardStep[] {
  const definitions = [
    {
      id: "start" as const,
      label: `1. Starting ${titleCase(tool)} login`,
      fallback: "Preparing the native login flow.",
    },
    {
      id: "browser" as const,
      label: "2. Browser opens",
      fallback: "AISW Desktop launches the provider login flow.",
    },
    {
      id: "login" as const,
      label: "3. Complete login in browser",
      fallback: "Finish the provider sign-in flow in the browser or terminal window.",
    },
    {
      id: "capture" as const,
      label: "4. Waiting for credential capture",
      fallback: "AISW waits for the upstream tool to persist the captured credentials.",
    },
    {
      id: "saved" as const,
      label: "5. Profile saved",
      fallback: "AISW stores the captured profile and refreshes desktop state.",
    },
  ];

  const stageIndex = new Map<OAuthWizardStep["id"], number>(
    definitions.map((definition, index) => [definition.id, index]),
  );
  const seen = new Map<
    OAuthWizardStep["id"],
    { detail: string; failed: boolean }
  >();
  let highestReached = -1;
  let terminalFailure = false;

  for (const event of events) {
    const stage = oauthEventStage(event);
    if (!stage) continue;
    const index = stageIndex.get(stage) ?? -1;
    if (index > highestReached) {
      highestReached = index;
    }
    const detail = event.message?.trim() || definitions[index].fallback;
    const failed = stage === "saved" && event.ok === false;
    if (failed) {
      terminalFailure = true;
    }
    seen.set(stage, { detail, failed });
  }

  if (oauthError) {
    highestReached = Math.max(highestReached, definitions.length - 1);
    terminalFailure = true;
  }

  return definitions.map((definition, index) => {
    const explicit = seen.get(definition.id);
    const isFinal = index === definitions.length - 1;
    let status: OAuthWizardStep["status"] = "pending";

    if (terminalFailure && isFinal) {
      status = "fail";
    } else if (highestReached >= index) {
      status = highestReached === index && !isFinal ? "warn" : "pass";
    }

    if (highestReached === definitions.length - 1 && !terminalFailure) {
      status = "pass";
    }

    return {
      id: definition.id,
      label: terminalFailure && isFinal ? "5. OAuth failed" : definition.label,
      detail:
        explicit?.detail ??
        (isFinal && oauthError ? oauthError : definition.fallback),
      status,
    };
  });
}

function oauthEventStage(event: OAuthProgressEvent): OAuthWizardStep["id"] | null {
  const phase = (event.phase ?? event.type ?? "").toLowerCase();
  switch (phase) {
    case "started":
      return "start";
    case "starting_upstream_auth":
    case "browser_launch":
      return "browser";
    case "waiting_for_user":
    case "waiting_for_login":
      return "login";
    case "applying_changes":
      return "capture";
    case "profile_saved":
    case "result":
      return "saved";
    default:
      return null;
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

function duplicateWarning(tool: string, profile: string) {
  return `${titleCase(tool)} already has a profile named ${profile}. Choose a different name or rename the existing profile first.`;
}

function isDuplicateProfileName(
  profiles: AppSnapshot["profiles"][string]["profiles"],
  currentName: string,
  nextName: string,
) {
  const normalizedCurrent = currentName.trim().toLowerCase();
  const normalizedNext = nextName.trim().toLowerCase();
  return profiles.some(
    (entry) => entry.name.trim().toLowerCase() === normalizedNext && entry.name.trim().toLowerCase() !== normalizedCurrent,
  );
}
