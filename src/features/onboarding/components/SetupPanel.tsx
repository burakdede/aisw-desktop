import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import { getShellGuidance, runDoctor } from "../../../lib/client";
import { sharedProfileEntries } from "../../../lib/profile-display";
import { AppBootstrap, AppSnapshot, InitReport } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import {
  commandForCurrentPlatform,
  installCommandForTool,
  installGuideUrlForTool,
  openExternalGuide,
  toolBinaryName,
} from "../../../lib/tool-guidance";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";

type LiveAccount = {
  tool: string;
  outcome?: string;
  auth_method?: string;
  matched_profile?: string | null;
};

type HealthItem = {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export function SetupPanel({
  bootstrap,
  snapshot,
  initReport,
  onOpenProfiles,
  onOpenSettings,
}: {
  bootstrap: AppBootstrap;
  snapshot: AppSnapshot;
  initReport: InitReport | undefined;
  onOpenProfiles: (tool: string) => void;
  onOpenSettings: () => void;
}) {
  const settings = bootstrap.settings;
  const { initMutation, addProfileMutation, useAllProfilesMutation, mutationLock } =
    useDesktopActions();
  const readEnabled = useMutationAwareQueryEnabled();
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor, enabled: readEnabled });
  const shellGuidance = useQuery({ queryKey: ["shell-guidance"], queryFn: getShellGuidance });
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [firstSwitchProfile, setFirstSwitchProfile] = useState("");

  const totalProfiles = useMemo(
    () => Object.values(snapshot.profiles).reduce((sum, entry) => sum + entry.profiles.length, 0),
    [snapshot.profiles],
  );
  const liveAccounts = readLiveAccounts(initReport);
  const liveAccountTools = useMemo(() => new Set(liveAccounts.map((account) => account.tool)), [liveAccounts]);
  const undetectedInstalledTools = useMemo(
    () =>
      snapshot.statuses.filter(
        (status) => status.binary_found && !liveAccountTools.has(status.tool),
      ),
    [liveAccountTools, snapshot.statuses],
  );
  const missingTools = useMemo(
    () => snapshot.statuses.filter((status) => !status.binary_found),
    [snapshot.statuses],
  );
  const healthItems = useMemo(
    () => buildHealthItems(bootstrap, snapshot, doctor.data),
    [bootstrap, snapshot, doctor.data],
  );
  const switchableProfiles = useMemo(
    () => sharedProfileEntries(settings, snapshot),
    [settings, snapshot],
  );
  const shouldShowSetup =
    totalProfiles === 0 ||
    liveAccounts.length > 0 ||
    undetectedInstalledTools.length > 0 ||
    missingTools.length > 0;

  function submitImport(event: FormEvent<HTMLFormElement>, tool: string) {
    event.preventDefault();
    const value = profileNames[tool]?.trim();
    if (!value) return;
    addProfileMutation.mutate({
      tool,
      profile: value,
      label: titleCase(value),
      stateMode: tool === "gemini" ? null : "isolated",
      importMode: { kind: "from_live" },
    });
  }

  if (!shouldShowSetup) {
    return null;
  }

  return (
    <SectionCard
      title="First-run setup"
      kicker="Onboarding"
      actions={
        <button
          className="primary-button"
          disabled={mutationLock.isBusy}
          onClick={() => initMutation.mutate()}
        >
          {initMutation.isPending ? "Scanning…" : "Start setup"}
        </button>
      }
    >
      <p className="inline-note">
        AISW Desktop manages local account profiles for Claude Code, Codex CLI, and Gemini CLI.
        Credentials stay on this machine. No cloud sync. No prompt logging. No proxy.
      </p>

      <div className="panel-grid panel-grid-2 diagnostics-body">
        <article className="diagnostic-card">
          <h3>Backend check</h3>
          <p className="inline-note">
            Selected runtime: <strong>{titleCase(bootstrap.settings.runtime_kind)}</strong>
          </p>
          <p className="inline-note">
            Bundled aisw: {bootstrap.runtime_status.inventory.bundled_path ?? "Not available in this build"}
          </p>
          <p className="inline-note">
            System aisw: {bootstrap.runtime_status.inventory.system_path ?? "Not found on PATH"}
          </p>
          {bootstrap.runtime_status.inventory.configured_path ? (
            <p className="inline-note">
              Configured custom path: {bootstrap.runtime_status.inventory.configured_path}
            </p>
          ) : null}
          <p className="inline-note">
            Resolved path: {bootstrap.runtime_status.resolved_path ?? "No aisw runtime resolved"}
          </p>
          <p className="inline-note">
            AISW home: {bootstrap.settings.aisw_home ?? "~/.aisw"}
          </p>
          <p className="inline-note">
            Version: {bootstrap.runtime_status.version?.version ?? "unknown"}
          </p>
          <p className="inline-note">
            Update channel: {bootstrap.settings.update_channel}
          </p>
        </article>

        <article className="diagnostic-card">
          <h3>Health check</h3>
          <div className="stack-list">
            {healthItems.map((item) => (
              <div key={item.label}>
                <p className={`diagnostic-status diagnostic-status-${item.status}`}>
                  {item.status === "pass" ? "✓" : item.status === "warn" ? "!" : "✕"} {item.label}
                </p>
                <p className="inline-note">{item.detail}</p>
              </div>
            ))}
            {!healthItems.length ? (
              <p className="inline-note">
                Run the setup scan to populate backend and tool health details.
              </p>
            ) : null}
          </div>
        </article>
      </div>

      <div className="panel-grid panel-grid-2 diagnostics-body">
        <div className="stack-list">
          <h3>Import existing accounts</h3>
          {liveAccounts.map((account) => (
            <form
              key={account.tool}
              className="list-row list-row-form"
              onSubmit={(event) => submitImport(event, account.tool)}
            >
              <div>
                <strong>{titleCase(account.tool)}</strong>
                <p>
                  {account.outcome ?? "unknown"} · {account.auth_method ?? "unknown"}
                  {account.matched_profile ? ` · matches ${account.matched_profile}` : ""}
                </p>
              </div>
              <div className="inline-form">
                <input
                  aria-label={`${account.tool} profile name`}
                  placeholder="profile name"
                  value={profileNames[account.tool] ?? ""}
                  onChange={(event) =>
                    setProfileNames((current) => ({
                      ...current,
                      [account.tool]: event.target.value,
                    }))
                  }
                />
                <button className="ghost-button" type="submit" disabled={mutationLock.isBusy}>
                  Import current login
                </button>
              </div>
            </form>
          ))}
          {undetectedInstalledTools.map((status) => (
            <article key={status.tool} className="list-row list-row-form">
              <div>
                <strong>{titleCase(status.tool)}</strong>
                <p>No live credentials detected</p>
              </div>
              <div className="inline-form">
                <button
                  className="ghost-button"
                  type="button"
                  aria-label={`Add ${status.tool} profile`}
                  disabled={mutationLock.isBusy}
                  onClick={() => onOpenProfiles(status.tool)}
                >
                  Add profile
                </button>
              </div>
            </article>
          ))}
          {missingTools.map((status) => {
            const binary = toolBinaryName(status.tool);
            return (
              <article key={status.tool} className="diagnostic-card diagnostic-warn">
                <h4>{titleCase(status.tool)} is not installed</h4>
                <p className="inline-note">
                  AISW Desktop cannot detect or switch {titleCase(status.tool)} until the{" "}
                  <code>{binary}</code> CLI is available on PATH.
                </p>
                <div className="diagnostic-remediation">
                  <code>{installCommandForTool(status.tool)}</code>
                  <code>{commandForCurrentPlatform(binary, "verify")}</code>
                  <code>{commandForCurrentPlatform(binary, "path")}</code>
                </div>
                <div className="button-row">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => openExternalGuide(installGuideUrlForTool(status.tool))}
                  >
                    Open installation guide
                  </button>
                </div>
              </article>
            );
          })}
          {!liveAccounts.length ? (
            undetectedInstalledTools.length || missingTools.length ? null : (
              <p className="inline-note">
                Run the setup scan to detect live Claude, Codex, and Gemini accounts.
              </p>
            )
          ) : null}
        </div>

        <div className="stack-list">
          <h3>First switch</h3>
          <p className="inline-note">
            Re-apply a shared profile name across installed tools to confirm the local control plane
            is working end to end.
          </p>
          <div className="inline-form">
            <select
              aria-label="First switch profile"
              value={firstSwitchProfile}
              onChange={(event) => setFirstSwitchProfile(event.target.value)}
            >
              <option value="">Select profile</option>
              {switchableProfiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {profile.label}
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              type="button"
              disabled={!firstSwitchProfile || mutationLock.isBusy || useAllProfilesMutation.isPending}
              onClick={() =>
                useAllProfilesMutation.mutate({
                  profile: firstSwitchProfile,
                  stateMode: resolveGlobalStateMode(snapshot),
                })
              }
            >
              {useAllProfilesMutation.isPending ? "Switching…" : "Switch now"}
            </button>
          </div>
          {!switchableProfiles.length ? (
            <div className="stack-list">
              <p className="inline-note">
                Import or create matching profile names across tools before running a switch-all check.
              </p>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => onOpenProfiles("claude")}>
                  Open profile setup
                </button>
              </div>
            </div>
          ) : null}

          <div className="diagnostic-card">
            <h4>Shell guidance</h4>
            {shellGuidance.data?.detected_shell ? (
              <p className="inline-note">
                Detected shell: <strong>{titleCase(shellGuidance.data.detected_shell)}</strong>
              </p>
            ) : null}
            <p className="inline-note">
              AISW Desktop writes live credential files directly. Existing terminal sessions only
              receive immediate environment exports such as <code>CLAUDE_CONFIG_DIR</code> and{" "}
              <code>CODEX_HOME</code> after you install the shell hook.
            </p>
            <p className="inline-note">
              Shell files should only be updated explicitly from the CLI or a future guided setup
              action, never silently.
            </p>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={onOpenSettings}>
                Open shell setup
              </button>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function readLiveAccounts(initReport: InitReport | undefined): LiveAccount[] {
  const result = initReport?.result as { live_accounts?: unknown } | undefined;
  const accounts = result?.live_accounts;
  return Array.isArray(accounts) ? (accounts as LiveAccount[]) : [];
}

function buildHealthItems(
  bootstrap: AppBootstrap,
  snapshot: AppSnapshot,
  doctorReport: Record<string, unknown> | undefined,
): HealthItem[] {
  const doctorChecks = Array.isArray(doctorReport?.checks)
    ? doctorReport.checks
    : [];
  const items: HealthItem[] = [
    {
      label: "AISW runtime contract",
      status: bootstrap.runtime_status.compatible ? "pass" : "fail",
      detail: bootstrap.runtime_status.compatible
        ? "Bundled or selected aisw runtime is compatible with this desktop build."
        : bootstrap.runtime_status.issues.join(" · ") || "Compatibility checks failed.",
    },
  ];

  doctorChecks.forEach((entry) => {
    const check = entry as { name?: string; status?: string; detail?: string };
    const status =
      check.status === "pass" || check.status === "warn" || check.status === "fail"
        ? check.status
        : "warn";
    items.push({
      label: check.name ?? "doctor",
      status,
      detail: check.detail ?? "No detail provided.",
    });
  });

  snapshot.statuses.forEach((status) => {
    items.push({
      label: `${titleCase(status.tool)} availability`,
      status: status.binary_found ? "pass" : "fail",
      detail: status.binary_found
        ? `${titleCase(status.tool)} detected${status.active_profile ? ` · active ${status.active_profile}` : ""}.`
        : `${titleCase(status.tool)} binary was not detected on PATH or in live state.`,
    });
  });

  return items;
}
