import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import {
  commandForCurrentPlatform,
  installCommandForTool,
  installGuideUrlForTool,
  openExternalGuide,
  toolBinaryName,
} from "../../../lib/tool-guidance";
import { resolveGlobalStateMode, supportedStateModes } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { StateModeField } from "../../shared/components/StateModeField";
import {
  activeSetLabel,
  contextDisplayLabel,
  profileSetHasUsableSelections,
  sharedProfileEntries,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import { titleCase } from "../../../lib/utils";
import {
  preferredProfileImportMode,
  supportsProfileImportMode,
  type ProfileImportMode,
} from "../../shared/profile-capabilities";
import { parseWorkspaceStatus } from "../../workspaces/workspace-parsers";
import { resolveWorkspaceActivationTarget } from "../../workspaces/workspace-activation";

export function OverviewPanel({
  snapshot,
  settings,
  toolCapabilities,
  onOpenProfiles,
  onOpenContexts,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (
    tool: string,
    expandedProfile?: string | null,
    options?: { mode?: ProfileImportMode },
  ) => void;
  onOpenContexts: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    addProfileMutation,
    activateWorkspaceTargetMutation,
    activateProfileSetMutation,
    useProfileMutation,
    useAllProfilesMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();
  const [quickSwitch, setQuickSwitch] = useState("");
  const sharedProfiles = useMemo(() => sharedProfileEntries(settings, snapshot), [settings, snapshot]);
  const quickSwitchOptions = useMemo(() => {
    const profileSets = [...(settings.profile_sets ?? [])]
      .filter((set) => profileSetHasUsableSelections(snapshot, set))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((set) => ({
        value: `set:${set.name}`,
        label: `Set: ${set.label ?? set.name}`,
      }));
    return [
      ...profileSets,
      ...sharedProfiles.map((profile) => ({
        value: `profile:${profile.name}`,
        label: `Saved profile: ${profile.label}`,
      })),
    ];
  }, [settings, sharedProfiles, snapshot]);

  const refresh = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    },
  });
  const workspaceStatus = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const showWorkspaceSummary = workspaceStatus.expectedContext !== "none";
  const hasWorkspaceMismatch =
    workspaceStatus.status === "mismatch" &&
    workspaceStatus.expectedContext !== workspaceStatus.currentContext;
  const expectedWorkspaceTarget = showWorkspaceSummary
    ? resolveWorkspaceActivationTarget(workspaceStatus.expectedContext, settings, snapshot)
    : null;
  const workspaceSummaryLabel =
    expectedWorkspaceTarget?.kind === "profile_set"
      ? "Expected set"
      : expectedWorkspaceTarget?.kind === "context"
        ? "Expected imported set"
        : "Expected set";
  const expectedWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.expectedContext);
  const currentWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.currentContext);
  const workspaceResult = lastCommandResults.global.workspace;
  const contextResult = lastCommandResults.global.context;
  const currentSetLabel = activeSetLabel(settings, snapshot);
  const currentSetProfiles = snapshot.statuses.map((status) => ({
    tool: status.tool,
    label: status.active_profile
      ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
      : null,
  }));

  return (
    <SectionCard
      title="Control Center"
      kicker="Safety and switching"
      actions={
        <div className="button-row">
          <select
            aria-label="Quick Switch"
            value={quickSwitch}
            onChange={(event) => setQuickSwitch(event.target.value)}
          >
            <option value="">Switch a set or saved profile…</option>
            {quickSwitchOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            aria-label="Switch all"
            disabled={mutationLock.isBusy}
            onClick={() => {
              if (!quickSwitch) return;
              if (quickSwitch.startsWith("set:")) {
                const name = quickSwitch.slice("set:".length);
                const profileSet = settings.profile_sets?.find((set) => set.name === name);
                activateProfileSetMutation.mutate({
                  name,
                  label: profileSet?.label ?? profileSet?.name,
                });
                return;
              }
              if (quickSwitch.startsWith("profile:")) {
                const profileName = quickSwitch.slice("profile:".length);
                const sharedProfile = sharedProfiles.find((profile) => profile.name === profileName);
                useAllProfilesMutation.mutate({
                  profile: profileName,
                  stateMode: resolveGlobalStateMode(snapshot),
                  label: sharedProfile?.label,
                });
              }
            }}
          >
            Apply selection
          </button>
          <button
            className="ghost-button"
            aria-label="Refresh state"
            disabled={mutationLock.isBusy || refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            Refresh
          </button>
        </div>
      }
    >
      <div className="overview-stack">
        <div className="overview-summary-grid">
          {currentSetLabel || quickSwitchOptions.length ? (
            <article className="overview-current-set">
              <div className="overview-current-set-copy">
                <p className="card-kicker">Current set</p>
                <h3>{currentSetLabel ?? "No set selected"}</h3>
                <p className="inline-note">
                  {snapshot.statuses.filter((status) => status.active_profile).length} of{" "}
                  {snapshot.statuses.length} tools are ready to switch.
                </p>
                <div className="overview-current-set-grid">
                  {currentSetProfiles.map((entry) => (
                    <p key={entry.tool} className="inline-note">
                      <strong>{titleCase(entry.tool)}:</strong> {entry.label ?? "Not configured"}
                    </p>
                  ))}
                </div>
              </div>
              <div className="overview-current-set-actions">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() => {
                    if (!quickSwitch) {
                      return;
                    }
                    if (quickSwitch.startsWith("set:")) {
                      const name = quickSwitch.slice("set:".length);
                      const profileSet = settings.profile_sets?.find((set) => set.name === name);
                      activateProfileSetMutation.mutate({
                        name,
                        label: profileSet?.label ?? profileSet?.name,
                      });
                      return;
                    }
                    if (quickSwitch.startsWith("profile:")) {
                      const profileName = quickSwitch.slice("profile:".length);
                      const sharedProfile = sharedProfiles.find((profile) => profile.name === profileName);
                      useAllProfilesMutation.mutate({
                        profile: profileName,
                        stateMode: resolveGlobalStateMode(snapshot),
                        label: sharedProfile?.label,
                      });
                    }
                  }}
                >
                  Switch set…
                </button>
              </div>
            </article>
          ) : null}
          {showWorkspaceSummary ? (
            <article className={`diagnostic-card ${hasWorkspaceMismatch ? "diagnostic-warn" : "diagnostic-pass"}`}>
              <h3>{hasWorkspaceMismatch ? "Workspace wants a different set" : "Workspace match"}</h3>
              <p className="inline-note">
                {workspaceSummaryLabel}: <strong>{expectedWorkspaceDisplay}</strong>
              </p>
              <p className="inline-note">
                Current set: <strong>{currentWorkspaceDisplay}</strong>
              </p>
              <p className="inline-note">
                Matched via {workspaceStatus.scope}: {workspaceStatus.target}
              </p>
              {hasWorkspaceMismatch ? (
                <div className="button-row">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => {
                      const target = resolveWorkspaceActivationTarget(
                        workspaceStatus.expectedContext,
                        settings,
                        snapshot,
                      );
                      if (!target) {
                        onOpenContexts();
                        return;
                      }
                      activateWorkspaceTargetMutation.mutate({
                        ...target,
                        matchedTarget: workspaceStatus.target,
                      });
                    }}
                  >
                    {expectedWorkspaceTarget ? "Use expected set now" : "Open sets"}
                  </button>
                </div>
              ) : null}
            </article>
          ) : null}
        </div>

        <div className="overview-tools-header">
          <div>
            <p className="card-kicker">Tools</p>
            <h3>Live account state</h3>
          </div>
          <p className="inline-note">
            Active profile, match status, secure storage, and drift warnings are surfaced here first.
          </p>
        </div>
        <div className="tool-grid overview-tool-grid">
          {snapshot.statuses.map((status) => (
            <ToolCard
              key={status.tool}
              status={status}
              profiles={snapshot.profiles[status.tool]?.profiles ?? []}
              lastResult={lastCommandResults.tool[status.tool]}
              mutationLocked={mutationLock.isBusy}
              refreshLocked={mutationLock.isBusy || refresh.isPending}
              onRefresh={() => refresh.mutate()}
              stateModes={supportedStateModes(status.tool, toolCapabilities)}
              settings={settings}
              snapshot={snapshot}
              onImport={(tool, profile, stateMode) =>
                supportsProfileImportMode(tool, toolCapabilities, "from_live")
                  ? addProfileMutation.mutate({
                      tool,
                      profile,
                      label: titleCase(profile),
                      stateMode,
                      importMode: { kind: "from_live" },
                    })
                  : onOpenProfiles(tool, null, {
                      mode: preferredProfileImportMode(tool, toolCapabilities, "from_live"),
                    })
              }
              onUse={(tool, profile, stateMode) =>
                useProfileMutation.mutate({
                  tool,
                  profile,
                  stateMode,
                  label: toolProfileDisplayLabel(settings, snapshot, tool, profile),
                })
              }
              onAddProfile={(tool) => onOpenProfiles(tool)}
              onOpenDetails={(tool, profile) => onOpenProfiles(tool, profile)}
              toolCapabilities={toolCapabilities}
            />
          ))}
        </div>
      </div>
      {lastCommandResults.global["switch-all"] || lastCommandResults.global["profile-set"] ? (
        <p
          className={`inline-note ${
            (lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"])
              ?.status === "error"
              ? "diagnostic-status-fail"
              : ""
          }`}
        >
          Last bulk result:{" "}
          {(lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"])
            ?.message}
          {(lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"])
            ?.remediation
            ? ` Remediation: ${
                (lastCommandResults.global["profile-set"] ??
                  lastCommandResults.global["switch-all"])?.remediation
              }`
            : ""}
        </p>
      ) : null}
      {workspaceResult ? (
        <p className={`inline-note ${workspaceResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
          Last workspace result: {workspaceResult.message}
          {workspaceResult.remediation ? ` Remediation: ${workspaceResult.remediation}` : ""}
        </p>
      ) : null}
      {contextResult ? (
        <p className={`inline-note ${contextResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
          Last context result: {contextResult.message}
          {contextResult.remediation ? ` Remediation: ${contextResult.remediation}` : ""}
        </p>
      ) : null}
    </SectionCard>
  );
}

function ToolCard({
  status,
  profiles,
  lastResult,
  mutationLocked,
  refreshLocked,
  onRefresh,
  stateModes,
  toolCapabilities,
  settings,
  snapshot,
  onImport,
  onUse,
  onAddProfile,
  onOpenDetails,
}: {
  status: ToolStatus;
  profiles: AppSnapshot["profiles"][string]["profiles"];
  lastResult?: {
    label: string;
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
  mutationLocked: boolean;
  refreshLocked: boolean;
  onRefresh: () => void;
  stateModes: string[];
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  onImport: (tool: string, profile: string, stateMode: string | null) => void;
  onUse: (tool: string, profile: string, stateMode: string | null) => void;
  onAddProfile: (tool: string) => void;
  onOpenDetails: (tool: string, profile: string | null | undefined) => void;
}) {
  const activeState = status.active_profile_applied;
  const [importName, setImportName] = useState("");
  const [stateMode, setStateMode] = useState(status.state_mode ?? stateModes[0] ?? "");
  const [selectedProfile, setSelectedProfile] = useState(
    status.active_profile ?? profiles[0]?.name ?? "",
  );
  const activeProfileLabel = status.active_profile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
    : null;
  const selectedProfileLabel = selectedProfile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, selectedProfile)
    : null;
  const supportsLiveImport = supportsProfileImportMode(status.tool, toolCapabilities, "from_live");

  useEffect(() => {
    if (!stateModes.length) {
      return;
    }
    if (!stateModes.includes(stateMode)) {
      setStateMode(stateModes[0]);
    }
  }, [stateMode, stateModes]);

  useEffect(() => {
    const availableProfiles = profiles.map((profile) => profile.name);
    const nextProfile = status.active_profile ?? availableProfiles[0] ?? "";
    if (!selectedProfile || !availableProfiles.includes(selectedProfile)) {
      setSelectedProfile(nextProfile);
    }
  }, [profiles, selectedProfile, status.active_profile]);

  return (
    <article className={`tool-card overview-tool-card overview-tool-card-${resolveCardState(status)}`}>
      <header className="overview-tool-card-header">
        <div>
          <p className="card-kicker">{titleCase(status.tool)}</p>
          <h3>{activeProfileLabel ?? "Not configured"}</h3>
        </div>
        <div className="overview-tool-status">
          <span className={`health-dot health-dot-${resolveCardState(status)}`} aria-hidden="true" />
          <span className={`pill ${pillClassForStatus(status)}`}>
            {statusPillLabel(status)}
          </span>
        </div>
      </header>
      <dl className="overview-tool-facts">
        <div>
          <dt>Active</dt>
          <dd>{activeProfileLabel ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Live match</dt>
          <dd>
            {activeState === null || activeState === undefined
              ? "Unknown"
              : activeState
                ? "Yes"
                : "Drifted"}
          </dd>
        </div>
        <div>
          <dt>Auth</dt>
          <dd>{status.auth_method ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Backend</dt>
          <dd>{status.credential_backend ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{status.state_mode ?? "n/a"}</dd>
        </div>
      </dl>
      {status.token_warning ? (
        <p className="inline-note">
          Token warning: {formatTokenWarning(status)}
        </p>
      ) : null}
      {status.warnings.length ? (
        <div className="stack-list">
          {status.warnings.map((warning, index) => (
            <p
              key={`${warning.code ?? warning.message ?? "warning"}-${index}`}
              className="inline-note"
            >
              Warning: {formatDiagnosticWarning(warning)}
            </p>
          ))}
        </div>
      ) : null}
      {lastResult ? (
        <p className={`inline-note ${lastResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
          Last result: {lastResult.message}
          {lastResult.remediation ? ` Remediation: ${lastResult.remediation}` : ""}
        </p>
      ) : null}
      {stateModes.length ? (
        <StateModeField
          name={`overview-state-mode-${status.tool}`}
          value={stateMode}
          options={stateModes}
          onChange={setStateMode}
        />
      ) : null}
      {!status.binary_found ? (
        <MissingBinaryGuidance
          tool={status.tool}
          onRefresh={onRefresh}
          refreshLocked={refreshLocked}
        />
      ) : null}
      {activeState === false ? (
        <div className="stack-list">
          <p className="inline-note">
            Live credentials changed outside AI Switch. Re-apply the active profile or import the current
            login as a new profile.
          </p>
          {supportsLiveImport ? (
            <div className="inline-form">
              <input
                aria-label={`import ${status.tool} current login`}
                placeholder="new profile name"
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
              />
              <button
                className="ghost-button"
                type="button"
                disabled={mutationLocked || !importName.trim()}
                onClick={() => {
                  const profile = importName.trim();
                  if (!profile) return;
                  onImport(status.tool, profile, stateModes.length ? stateMode : null);
                  setImportName("");
                }}
              >
                Import current as new
              </button>
            </div>
          ) : (
            <div className="stack-list">
              <p className="inline-note">
                This runtime does not support one-click capture for {titleCase(status.tool)}.
                Open profile setup to choose another sign-in method.
              </p>
              <button
                className="ghost-button"
                type="button"
                disabled={mutationLocked}
                onClick={() => onAddProfile(status.tool)}
              >
                Open profile setup
              </button>
            </div>
          )}
        </div>
      ) : null}
      {profiles.length ? (
        <div className="stack-list">
          <label className="stacked-form">
            <span>Switch profile</span>
            <select
              aria-label={`Switch ${status.tool} profile`}
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {toolProfileDisplayLabel(settings, snapshot, status.tool, profile.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="button-row">
        <button
          className={profiles.length ? "primary-button" : "ghost-button"}
          type="button"
          disabled={mutationLocked}
          onClick={() =>
            profiles.length && selectedProfile
              ? onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null)
              : onAddProfile(status.tool)
          }
        >
          {profiles.length
            ? selectedProfile && selectedProfile === status.active_profile
              ? `Re-apply ${selectedProfileLabel}`
              : selectedProfileLabel
                ? `Switch to ${selectedProfileLabel}`
                : "Switch profile"
            : "Add profile"}
        </button>
        {status.active_profile ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => onOpenDetails(status.tool, status.active_profile)}
          >
            Open details
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MissingBinaryGuidance({
  tool,
  onRefresh,
  refreshLocked,
}: {
  tool: string;
  onRefresh: () => void;
  refreshLocked: boolean;
}) {
  const binary = toolBinaryName(tool);
  const verifyCommand = commandForCurrentPlatform(binary, "verify");
  const pathCommand = commandForCurrentPlatform(binary, "path");
  const installCommand = installCommandForTool(tool);
  const guideUrl = installGuideUrlForTool(tool);

  return (
    <div className="stack-list">
      <p className="inline-note">
        {titleCase(tool)} is not available on PATH, so AI Switch cannot switch or verify that
        tool yet.
      </p>
      <p className="inline-note">
        Install: <code>{installCommand}</code>
      </p>
      <p className="inline-note">
        Verify binary: <code>{verifyCommand}</code>
      </p>
      <p className="inline-note">
        Check PATH: <code>{pathCommand}</code>
      </p>
      <p className="inline-note">
        Refresh state after the CLI is installed or after you update your shell PATH.
      </p>
      <div className="button-row">
        <button
          className="ghost-button"
          type="button"
          onClick={() => openExternalGuide(guideUrl)}
        >
          Open installation guide
        </button>
        <button className="ghost-button" type="button" disabled={refreshLocked} onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function formatTokenWarning(status: ToolStatus) {
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

function formatDiagnosticWarning(
  warning: ToolStatus["warnings"][number],
) {
  const detail = warning.message ?? warning.code ?? "Warning reported by AI Switch.";
  return warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;
}

function resolveCardState(status: ToolStatus) {
  if (!status.binary_found) {
    return "neutral";
  }
  if (status.active_profile_applied === false || status.token_warning || status.warnings.length) {
    return "warning";
  }
  if (!status.active_profile) {
    return "neutral";
  }
  return "ok";
}

function statusPillLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return "Missing";
  }
  if (!status.active_profile) {
    return "Not configured";
  }
  if (status.active_profile_applied === false) {
    return "Drifted";
  }
  if (status.token_warning || status.warnings.length) {
    return "Needs review";
  }
  return "Live match";
}

function pillClassForStatus(status: ToolStatus) {
  if (!status.binary_found) {
    return "pill-soft";
  }
  if (!status.active_profile) {
    return "pill-soft";
  }
  if (status.active_profile_applied === false || status.token_warning || status.warnings.length) {
    return "pill-warn";
  }
  return "pill-ok";
}
