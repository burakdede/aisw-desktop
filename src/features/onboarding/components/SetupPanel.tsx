import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DesktopStatusStrip } from "../../../components/DesktopStatusStrip";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import { getShellGuidance, runDoctor, updateSettings } from "../../../lib/client";
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
import {
  preferredProfileImportMode,
  supportsProfileImportMode,
} from "../../shared/profile-capabilities";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { invalidatePostMutationQueries } from "../../shared/postMutationRefresh";
import type { SettingsSection } from "../../settings/components/SettingsPanel";
import type { ProfileImportMode } from "../../shared/profile-capabilities";

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

type SetupStep = "accounts" | "runtime" | "switch" | "terminal";

export function shouldShowSetupFlow(
  snapshot: AppSnapshot,
  initReport: InitReport | undefined,
) {
  const totalProfiles = Object.values(snapshot.profiles).reduce(
    (sum, entry) => sum + entry.profiles.length,
    0,
  );
  const liveAccounts = readLiveAccounts(initReport);
  const liveAccountTools = new Set(liveAccounts.map((account) => account.tool));
  const undetectedInstalledTools = snapshot.statuses.filter(
    (status) => status.binary_found && !liveAccountTools.has(status.tool),
  );
  const installedToolsNeedingProfile = undetectedInstalledTools.filter(
    (status) => (snapshot.profiles[status.tool]?.profiles.length ?? 0) === 0,
  );

  return (
    totalProfiles === 0 ||
    liveAccounts.length > 0 ||
    installedToolsNeedingProfile.length > 0
  );
}

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
  onOpenProfiles: (tool: string, options?: { mode?: ProfileImportMode }) => void;
  onOpenSettings: (section?: SettingsSection) => void;
}) {
  const settings = bootstrap.settings;
  const queryClient = useQueryClient();
  const toolCapabilities = bootstrap.runtime_status.capabilities?.tools ?? {};
  const { initMutation, addProfileMutation, useAllProfilesMutation, mutationLock } =
    useDesktopActions();
  const readEnabled = useMutationAwareQueryEnabled();
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor, enabled: readEnabled });
  const shellGuidance = useQuery({
    queryKey: ["shell-guidance"],
    queryFn: getShellGuidance,
    enabled: readEnabled,
  });
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [profileLabels, setProfileLabels] = useState<Record<string, string>>({});
  const [firstSwitchProfile, setFirstSwitchProfile] = useState("");
  const [pendingLiveImport, setPendingLiveImport] = useState<LiveAccount | null>(null);
  const liveAccounts = readLiveAccounts(initReport);
  const liveAccountTools = useMemo(() => new Set(liveAccounts.map((account) => account.tool)), [liveAccounts]);
  const undetectedInstalledTools = useMemo(
    () =>
      snapshot.statuses.filter(
        (status) => status.binary_found && !liveAccountTools.has(status.tool),
      ),
    [liveAccountTools, snapshot.statuses],
  );
  const installedToolsNeedingProfile = useMemo(
    () =>
      undetectedInstalledTools.filter(
        (status) => (snapshot.profiles[status.tool]?.profiles.length ?? 0) === 0,
      ),
    [snapshot.profiles, undetectedInstalledTools],
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
  const shouldShowSetup = shouldShowSetupFlow(snapshot, initReport);
  const [activeStep, setActiveStep] = useState<SetupStep>(() =>
    defaultSetupStep(snapshot, initReport),
  );
  const restoreBundledRuntimeMutation = useMutation({
    mutationFn: async () =>
      updateSettings({
        runtime_kind: "bundled",
        runtime_path: null,
        aisw_home: settings.aisw_home ?? null,
        update_channel: settings.update_channel,
        profile_labels: settings.profile_labels,
        profile_sets: settings.profile_sets,
      }),
    onSuccess: async () => {
      await invalidatePostMutationQueries(queryClient);
    },
  });
  const pendingProfileName = pendingLiveImport ? profileNames[pendingLiveImport.tool] ?? "" : "";
  const pendingProfileLabel = pendingLiveImport ? profileLabels[pendingLiveImport.tool] ?? "" : "";
  const setupPrimaryActionLabel = initMutation.isPending
    ? "Checking This Mac…"
    : initReport
      ? "Refresh Setup"
      : "Get Started";

  useEffect(() => {
    if (!pendingLiveImport) {
      return;
    }

    const name = profileNames[pendingLiveImport.tool]?.trim() ?? "";
    if (!name) {
      return;
    }

    const currentLabel = profileLabels[pendingLiveImport.tool] ?? "";
    if (currentLabel.trim().length > 0) {
      return;
    }

    setProfileLabels((current) => ({
      ...current,
      [pendingLiveImport.tool]: `${titleCase(name)} account`,
    }));
  }, [pendingLiveImport, profileLabels, profileNames]);

  useEffect(() => {
    if (!pendingLiveImport || !addProfileMutation.isSuccess) {
      return;
    }
    setPendingLiveImport(null);
  }, [addProfileMutation.isSuccess, pendingLiveImport]);

  function submitImport(event: FormEvent<HTMLFormElement>, tool: string) {
    event.preventDefault();
    const value = profileNames[tool]?.trim();
    if (!value) return;
    if (!supportsProfileImportMode(tool, toolCapabilities, "from_live")) {
      onOpenProfiles(tool, {
        mode: preferredProfileImportMode(tool, toolCapabilities, "from_live"),
      });
      return;
    }
    addProfileMutation.mutate({
      tool,
      profile: value,
      label: profileLabels[tool]?.trim() || `${titleCase(value)} account`,
      stateMode: tool === "gemini" ? null : "isolated",
      importMode: { kind: "from_live" },
    });
  }

  function openLiveImport(account: LiveAccount) {
    setPendingLiveImport(account);
    setProfileNames((current) => ({
      ...current,
      [account.tool]: current[account.tool] ?? "",
    }));
    setProfileLabels((current) => ({
      ...current,
      [account.tool]: current[account.tool] ?? "",
    }));
  }

  function closeLiveImport() {
    setPendingLiveImport(null);
  }

  if (!shouldShowSetup) {
    return null;
  }

  const setupSteps = [
    { value: "runtime", label: "Welcome" },
    { value: "accounts", label: "Accounts" },
    { value: "switch", label: "Verify" },
    { value: "terminal", label: "Terminal" },
  ] satisfies Array<{ value: SetupStep; label: string }>;
  const needsAttentionCount =
    liveAccounts.length + installedToolsNeedingProfile.length + missingTools.length;
  const switchReady = switchableProfiles.length > 0;
  const secureStorage = describeSecureStorage(snapshot, toolCapabilities);
  const runtimeSummary = summarizeRuntime(settings.runtime_kind);
  const runtimeRows = buildRuntimeRows(bootstrap, snapshot, toolCapabilities);

  return (
    <SectionCard
      title="Welcome to AI Switch"
      kicker="First launch"
      actions={
        <button
          className="primary-button"
          disabled={mutationLock.isBusy}
          onClick={() => initMutation.mutate()}
        >
          {setupPrimaryActionLabel}
        </button>
      }
    >
      <DesktopStatusStrip
        ariaLabel="Onboarding highlights"
        items={[
          {
            label: "Welcome",
            value: "Safe local account switching",
            note: "Bring in the accounts you already use, confirm the included runtime is ready, and verify one shared switch without leaving this Mac.",
          },
          {
            label: "Progress",
            value: needsAttentionCount ? `${needsAttentionCount} setup action${needsAttentionCount === 1 ? "" : "s"}` : "Ready to switch",
            note: switchReady
              ? "At least one reusable profile is ready for a first switch."
              : "Save one profile first, then verify the first shared switch.",
          },
          {
            label: "Trust",
            value: "Local only",
            pills: ["Credentials stay local", "Included runtime", "No telemetry", "No traffic proxy"],
          },
        ]}
      />

      <SplitView
        className="onboarding-layout onboarding-layout-compact"
        primaryClassName="onboarding-summary-pane"
        secondaryClassName="onboarding-actions-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card onboarding-trust-card">
              <h3>Private and local</h3>
              <p className="inline-note">
                AI Switch is a local control center for coding-agent accounts. It keeps the
                active account clear, switching fast, and recovery safe.
              </p>
              <div className="trust-list">
                <p className="trust-list-item">Credentials stay on this Mac</p>
                <p className="trust-list-item">No telemetry</p>
                <p className="trust-list-item">No prompt or API traffic proxy</p>
                <p className="trust-list-item">Included runtime</p>
              </div>
            </article>
            <article className="diagnostic-card onboarding-step-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Setup</p>
                  <h3>First launch</h3>
                </div>
                <span className={`pill ${needsAttentionCount ? "pill-soft" : "pill-ok"}`}>
                  {needsAttentionCount ? `${needsAttentionCount} action${needsAttentionCount === 1 ? "" : "s"}` : "Ready"}
                </span>
              </div>
              <SegmentedControl
                ariaLabel="Setup steps"
                options={setupSteps}
                value={activeStep}
                onChange={setActiveStep}
                kind="tabs"
              />
              <div className="stack-list onboarding-status-stack">
                <div>
                  <p className={`diagnostic-status diagnostic-status-${bootstrap.runtime_status.compatible ? "pass" : "warn"}`}>
                    Runtime
                  </p>
                  <p className="inline-note">
                    {bootstrap.runtime_status.compatible
                      ? "The included runtime is ready for desktop switching."
                      : "Runtime setup needs attention before switching."}
                  </p>
                </div>
                <div>
                  <p className="diagnostic-status diagnostic-status-warn">Profiles</p>
                  <p className="inline-note">
                    {needsAttentionCount
                      ? `${needsAttentionCount} import, install, or setup action${needsAttentionCount === 1 ? "" : "s"} remain.`
                      : "Installed tools already have reusable profiles."}
                  </p>
                </div>
                <div>
                  <p className={`diagnostic-status ${switchReady ? "diagnostic-status-pass" : "diagnostic-status-warn"}`}>
                    Shared switch
                  </p>
                  <p className="inline-note">
                    {switchReady
                      ? "A matching shared profile is ready for a first switch check."
                      : "Add at least one reusable profile before verifying a shared switch."}
                  </p>
                </div>
              </div>
            </article>
            <article className="diagnostic-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Runtime</p>
                  <h3>Bundled AI Switch runtime</h3>
                </div>
                <span className={`pill ${bootstrap.runtime_status.compatible ? "pill-ok" : "pill-soft"}`}>
                  {bootstrap.runtime_status.compatible ? "Ready" : "Needs attention"}
                </span>
              </div>
              <p className="inline-note">
                Source: <strong>{runtimeSummary.source}</strong>
              </p>
              <p className="inline-note">
                Version: {bootstrap.runtime_status.version?.version ?? "unknown"}
              </p>
              <p className="inline-note">
                Data folder: {bootstrap.settings.aisw_home ?? "Managed automatically"}
              </p>
              <p className="inline-note">
                Secure storage: {secureStorage}
              </p>
            </article>
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
            {activeStep === "runtime" ? (
              <>
                <article className="diagnostic-card desktop-pane-intro">
                  <h3>Confirm this Mac is ready</h3>
                  <p className="inline-note">
                    AI Switch uses the included runtime by default. Confirm that local storage
                    and secure storage are ready, then save your first profile.
                  </p>
                </article>
                <article className="diagnostic-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Runtime</p>
                      <h3>Bundled AI Switch runtime</h3>
                    </div>
                    <span className={`pill ${bootstrap.runtime_status.compatible ? "pill-ok" : "pill-soft"}`}>
                      {bootstrap.runtime_status.compatible ? "Ready" : "Needs attention"}
                    </span>
                  </div>
                  <p className="inline-note">
                    {runtimeSummary.description}
                  </p>
                  <div className="stack-list">
                    {runtimeRows.map((item) => (
                      <div key={item.label}>
                        <p className={`diagnostic-status diagnostic-status-${item.status}`}>
                          {item.status === "pass" ? "✓" : item.status === "warn" ? "!" : "✕"} {item.label}
                        </p>
                        <p className="inline-note">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="button-row">
                    {settings.runtime_kind !== "bundled" ? (
                      <button
                        className="primary-button"
                        type="button"
                        disabled={restoreBundledRuntimeMutation.isPending}
                        onClick={() => restoreBundledRuntimeMutation.mutate()}
                      >
                        {restoreBundledRuntimeMutation.isPending
                          ? "Switching to Included Runtime…"
                          : "Use Included Runtime"}
                      </button>
                    ) : null}
                    <button className="ghost-button" type="button" onClick={() => onOpenSettings("runtime")}>
                      Runtime Settings
                    </button>
                  </div>
                  {restoreBundledRuntimeMutation.error ? (
                    <p className="inline-note">
                      {restoreBundledRuntimeMutation.error instanceof Error
                        ? restoreBundledRuntimeMutation.error.message
                        : "Could not switch back to the bundled AI Switch runtime."}
                    </p>
                  ) : null}
                </article>

                <article className="diagnostic-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Next</p>
                      <h3>After setup</h3>
                    </div>
                  </div>
                  <div className="stack-list">
                    <div>
                      <p className="diagnostic-status diagnostic-status-pass">1. Save your first profile</p>
                      <p className="inline-note">
                        Import the login already open in a supported tool, or add a new profile from
                        the Profiles section.
                      </p>
                    </div>
                    <div>
                      <p className="diagnostic-status diagnostic-status-pass">2. Verify one switch</p>
                      <p className="inline-note">
                        Re-apply a shared profile once so you know switching works before you start coding.
                      </p>
                    </div>
                    <div>
                      <p className="diagnostic-status diagnostic-status-pass">3. Add terminal integration later if needed</p>
                      <p className="inline-note">
                        Most people can skip terminal integration unless they need already-open shells
                        to update immediately.
                      </p>
                    </div>
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
                        Run the setup scan to populate runtime, storage, and tool health details.
                      </p>
                    ) : null}
                  </div>
                </article>
              </>
            ) : null}

            {activeStep === "accounts" ? (
              <>
                <article className="diagnostic-card desktop-pane-intro">
                  <h3>Save the accounts you already use</h3>
                  <p className="inline-note">
                    Save current logins as reusable profiles, add missing profiles where needed, and
                    ignore tools you do not use yet.
                  </p>
                </article>

                <div className="desktop-pane-section onboarding-detection-stack">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Detection</p>
                <h3>Detected tools</h3>
              </div>
              <p className="inline-note">
                Saved accounts become reusable profiles that you can switch again later.
              </p>
            </div>
            {liveAccounts.map((account) => (
              <article
                key={account.tool}
                className="diagnostic-card onboarding-tool-card"
              >
                <div className="desktop-pane-section-header">
                  <div>
                    <h4>{titleCase(account.tool)}</h4>
                    <p className="inline-note">
                      {account.outcome ?? "unknown"} · {account.auth_method ?? "unknown"}
                      {account.matched_profile ? ` · matches ${account.matched_profile}` : ""}
                    </p>
                  </div>
                  <span className="pill pill-ok">Current login</span>
                </div>
                {!supportsProfileImportMode(account.tool, toolCapabilities, "from_live") ? (
                  <p className="inline-note">
                    This AI Switch release cannot import the current {titleCase(account.tool)} login
                    directly. Open profile setup to choose another sign-in method.
                  </p>
                ) : null}
                <div className="stack-list">
                  {supportsProfileImportMode(account.tool, toolCapabilities, "from_live") ? (
                    <p className="inline-note">
                      Save the current {titleCase(account.tool)} login as a reusable profile in a
                      focused setup sheet.
                    </p>
                  ) : null}
                </div>
                <div className="button-row">
                  {supportsProfileImportMode(account.tool, toolCapabilities, "from_live") ? (
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() => openLiveImport(account)}
                    >
                      Import login
                    </button>
                  ) : (
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() =>
                        onOpenProfiles(account.tool, {
                          mode: preferredProfileImportMode(account.tool, toolCapabilities, "from_live"),
                        })
                      }
                    >
                      Open profile setup
                    </button>
                  )}
                </div>
              </article>
            ))}
            {installedToolsNeedingProfile.map((status) => (
              <article key={status.tool} className="diagnostic-card onboarding-tool-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <h4>{titleCase(status.tool)}</h4>
                    <p className="inline-note">Installed, but no saved profile yet</p>
                  </div>
                  <span className="pill pill-soft">Needs profile</span>
                </div>
                <div className="button-row">
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
                <article key={status.tool} className="diagnostic-card diagnostic-warn onboarding-tool-card">
                  <div className="desktop-pane-section-header">
                    <div>
                    <h4>{titleCase(status.tool)} is not installed</h4>
                      <p className="inline-note">Optional for now</p>
                    </div>
                    <span className="pill pill-soft">Not installed</span>
                  </div>
                  <p className="inline-note">
                    AI Switch can start without {titleCase(status.tool)}. Install the{" "}
                    <code>{binary}</code> tool later when you want to manage that provider here.
                  </p>
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
              installedToolsNeedingProfile.length || missingTools.length ? null : (
                <p className="inline-note">
                  Run the setup scan to detect live Claude, Codex, and Gemini accounts.
                </p>
              )
            ) : null}
                </div>
              </>
            ) : null}

            {activeStep === "switch" ? (
              <article className="diagnostic-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Verify</p>
                    <h3>Try one safe switch</h3>
                  </div>
                  <p className="inline-note">
                    Re-apply one shared profile across installed tools so you know switching works
                    before you start coding.
                  </p>
                </div>
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
                        label:
                          switchableProfiles.find((profile) => profile.name === firstSwitchProfile)?.label ??
                          undefined,
                      })
                    }
                  >
                    {useAllProfilesMutation.isPending ? "Switching…" : "Switch now"}
                  </button>
                </div>
                {!switchableProfiles.length ? (
                  <div className="stack-list">
                    <p className="inline-note">
                      Import or create matching profile names across tools before running a shared
                      switch check.
                    </p>
                    <div className="button-row">
                      <button className="ghost-button" type="button" onClick={() => onOpenProfiles("claude")}>
                        Open profile setup
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ) : null}

            {activeStep === "terminal" ? (
              <article className="diagnostic-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Optional</p>
                    <h3>Terminal integration</h3>
                  </div>
                  <p className="inline-note">
                    Optional. AI Switch updates live credential files without terminal integration.
                    Turn this on later only if already-open terminal sessions need to pick up changes
                    immediately.
                  </p>
                </div>
                {shellGuidance.data?.detected_shell ? (
                  <p className="inline-note">
                    Detected shell: <strong>{titleCase(shellGuidance.data.detected_shell)}</strong>
                  </p>
                ) : null}
                <p className="inline-note">
                  The desktop app writes live credential files directly. Most people can skip this and
                  still switch accounts normally.
                </p>
                <p className="inline-note">
                  Shell files should only be updated explicitly from guided setup, never silently.
                </p>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => onOpenSettings("shell")}>
                    Open terminal setup
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        }
      />
      {pendingLiveImport ? (
        <div className="quick-switch-overlay" role="presentation" onClick={closeLiveImport}>
          <section
            className="quick-switch-palette profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Import ${titleCase(pendingLiveImport.tool)} Login`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Import Current Login</p>
                <h3>Import {titleCase(pendingLiveImport.tool)} login</h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeLiveImport}>
                Close
              </button>
            </div>
            <p className="inline-note">
              Save the account that {titleCase(pendingLiveImport.tool)} is already using as a
              reusable profile. This imported profile becomes the active saved login for this tool.
            </p>
            <form className="stacked-form" onSubmit={(event) => submitImport(event, pendingLiveImport.tool)}>
              <label>
                Profile name
                <input
                  value={pendingProfileName}
                  onChange={(event) =>
                    setProfileNames((current) => ({
                      ...current,
                      [pendingLiveImport.tool]: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Label
                <input
                  value={pendingProfileLabel}
                  onChange={(event) =>
                    setProfileLabels((current) => ({
                      ...current,
                      [pendingLiveImport.tool]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeLiveImport}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={mutationLock.isBusy || addProfileMutation.isPending || !pendingProfileName.trim()}
                >
                  {addProfileMutation.isPending ? "Importing…" : "Import"}
                </button>
              </div>
              {addProfileMutation.error ? (
                <p className="inline-note">{addProfileMutation.error.message}</p>
              ) : null}
            </form>
          </section>
        </div>
      ) : null}
    </SectionCard>
  );
}

function defaultSetupStep(snapshot: AppSnapshot, initReport: InitReport | undefined): SetupStep {
  const liveAccounts = readLiveAccounts(initReport);
  const liveAccountTools = new Set(liveAccounts.map((account) => account.tool));
  const missingTools = snapshot.statuses.filter((status) => !status.binary_found);
  const installedToolsNeedingProfile = snapshot.statuses.filter(
    (status) =>
      status.binary_found &&
      !liveAccountTools.has(status.tool) &&
      (snapshot.profiles[status.tool]?.profiles.length ?? 0) === 0,
  );

  if (liveAccounts.length || installedToolsNeedingProfile.length || missingTools.length) {
    return "accounts";
  }

  return "runtime";
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
      label: "Desktop runtime",
      status: bootstrap.runtime_status.compatible ? "pass" : "fail",
      detail: bootstrap.runtime_status.compatible
        ? bootstrap.settings.runtime_kind === "bundled"
          ? "Included runtime is compatible with this desktop build."
          : "Selected runtime override is compatible with this desktop build."
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

function summarizeRuntime(runtimeKind: AppBootstrap["settings"]["runtime_kind"]) {
  if (runtimeKind === "bundled") {
    return {
      source: "Included with this app",
      description: "AI Switch is already set to use the runtime bundled with this app.",
    };
  }
  if (runtimeKind === "system") {
    return {
      source: "System override",
      description:
        "AI Switch is currently pointing at a system-installed runtime instead of the included one.",
    };
  }
  return {
    source: "Custom override",
    description:
      "AI Switch is currently pointing at a custom runtime path instead of the included one.",
  };
}

function buildRuntimeRows(
  bootstrap: AppBootstrap,
  snapshot: AppSnapshot,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
): HealthItem[] {
  return [
    {
      label: "AI Switch runtime",
      status: bootstrap.runtime_status.compatible ? "pass" : "warn",
      detail: bootstrap.settings.runtime_kind === "bundled"
        ? `Ready. Version ${bootstrap.runtime_status.version?.version ?? "unknown"}.`
        : `Available, but AI Switch is currently using ${summarizeRuntime(bootstrap.settings.runtime_kind).source.toLowerCase()}.`,
    },
    {
      label: "Data folder",
      status: "pass",
      detail: bootstrap.settings.aisw_home
        ? `Custom folder set to ${bootstrap.settings.aisw_home}.`
        : "Managed automatically inside the standard AI Switch data location.",
    },
    {
      label: "Secure storage",
      status: supportsSecureStorage(snapshot, toolCapabilities) ? "pass" : "warn",
      detail: describeSecureStorage(snapshot, toolCapabilities),
    },
  ];
}

function supportsSecureStorage(
  snapshot: AppSnapshot,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  return (
    snapshot.statuses.some((status) =>
      status.credential_backend === "system_keyring" || status.credential_backend === "system-keyring",
    ) ||
    Object.values(toolCapabilities).some((capability) =>
      capability.credential_backends.includes("system-keyring"),
    )
  );
}

function describeSecureStorage(
  snapshot: AppSnapshot,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  if (!supportsSecureStorage(snapshot, toolCapabilities)) {
    return "Secure storage has not been confirmed yet. You can still continue with local file-based profiles.";
  }

  const platform = typeof navigator === "undefined" ? "" : navigator.platform.toLowerCase();
  if (platform.includes("mac")) {
    return "Login Keychain available for local credential storage.";
  }
  if (platform.includes("win")) {
    return "Windows Credential Manager available for local credential storage.";
  }
  return "System keyring available for local credential storage.";
}
