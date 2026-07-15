import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DialogSurface } from "../../../components/DialogSurface";
import { SourceListPanel } from "../../../components/SourceListPanel";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { getShellGuidance, runDoctor, updateSettings } from "../../../lib/client";
import { sharedProfileEntries } from "../../../lib/profile-display";
import {
  runtimeReadinessLabel,
  runtimeSummary,
} from "../../../lib/runtime-display";
import { AppBootstrap, AppSnapshot, InitReport } from "../../../lib/schemas";
import { toolSupportsEditableStateModes } from "../../../lib/tool-registry";
import { toolDisplayName } from "../../../lib/tool-display";
import { titleCase } from "../../../lib/utils";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../../shared/terminal-integration-language";
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

type SetupStep = "accounts" | "runtime" | "switch" | "terminal" | "done";
type OnboardingAccountItem =
  | { key: string; kind: "live"; account: LiveAccount }
  | {
      key: string;
      kind: "needs-profile";
      status: AppSnapshot["statuses"][number];
    }
  | {
      key: string;
      kind: "missing";
      status: AppSnapshot["statuses"][number];
    };

export function shouldShowSetupFlow(
  snapshot: AppSnapshot,
  initReport: InitReport | undefined,
  forceOpen = false,
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
    forceOpen ||
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
  forcedOpen = false,
  onCloseSetup,
}: {
  bootstrap: AppBootstrap;
  snapshot: AppSnapshot;
  initReport: InitReport | undefined;
  onOpenProfiles: (tool: string, options?: { mode?: ProfileImportMode }) => void;
  onOpenSettings: (section?: SettingsSection) => void;
  forcedOpen?: boolean;
  onCloseSetup?: () => void;
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
  const shouldShowSetup = shouldShowSetupFlow(snapshot, initReport, forcedOpen);
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
    ? "Checking This Computer…"
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
      stateMode: toolSupportsEditableStateModes(tool) ? "isolated" : null,
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
    { value: "switch", label: "First switch" },
    { value: "terminal", label: "Terminal" },
    { value: "done", label: "Done" },
  ] satisfies Array<{ value: SetupStep; label: string }>;
  const activeStepIndex = setupSteps.findIndex((step) => step.value === activeStep);
  const previousStep = activeStepIndex > 0 ? setupSteps[activeStepIndex - 1] : null;
  const nextStep =
    activeStepIndex >= 0 && activeStepIndex < setupSteps.length - 1
      ? setupSteps[activeStepIndex + 1]
      : null;
  const needsAttentionCount =
    liveAccounts.length + installedToolsNeedingProfile.length + missingTools.length;
  const switchReady = switchableProfiles.length > 0;
  const secureStorage = describeSecureStorage(snapshot, toolCapabilities);
  const currentRuntimeSummary = runtimeSummary(settings.runtime_kind);
  const runtimeRows = buildRuntimeRows(bootstrap, snapshot, toolCapabilities);
  const trustRows = [
    "Credentials stay on this computer",
    "No telemetry",
    "No prompt or API traffic proxy",
    "Built-in desktop engine ready",
  ];
  const installedNow = snapshot.statuses.filter((status) => status.binary_found).map((status) => status.tool);
  const accountItems = useMemo<OnboardingAccountItem[]>(
    () => [
      ...liveAccounts.map((account) => ({
        key: `live:${account.tool}`,
        kind: "live" as const,
        account,
      })),
      ...installedToolsNeedingProfile.map((status) => ({
        key: `needs-profile:${status.tool}`,
        kind: "needs-profile" as const,
        status,
      })),
      ...missingTools.map((status) => ({
        key: `missing:${status.tool}`,
        kind: "missing" as const,
        status,
      })),
    ],
    [installedToolsNeedingProfile, liveAccounts, missingTools],
  );
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAccountKey && accountItems.some((item) => item.key === selectedAccountKey)) {
      return;
    }
    setSelectedAccountKey(selectDefaultAccountItem(accountItems)?.key ?? null);
  }, [accountItems, selectedAccountKey]);

  const selectedAccountItem =
    accountItems.find((item) => item.key === selectedAccountKey) ??
    selectDefaultAccountItem(accountItems) ??
    null;

  return (
    <div className="setup-screen screen-content">
      <div className="setup-screen-toolbar">
        <div className="setup-screen-toolbar-copy">
          <h2 className="visually-hidden">Get started</h2>
          <span className="setup-screen-kicker">Local-only setup</span>
          <p className="inline-note">
            Set up AI Switch on this computer before you switch coding-agent profiles.
          </p>
        </div>
        <div className="button-row setup-screen-toolbar-actions">
          {forcedOpen ? (
            <button className="ghost-button" type="button" onClick={onCloseSetup}>
              Close setup
            </button>
          ) : null}
          <button
            className="primary-button"
            disabled={mutationLock.isBusy}
            onClick={() => initMutation.mutate()}
          >
            {setupPrimaryActionLabel}
          </button>
        </div>
      </div>
      <SplitView
        className="onboarding-layout onboarding-layout-compact"
        primaryClassName="onboarding-summary-pane"
        secondaryClassName="onboarding-actions-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card onboarding-overview">
              <SourceListPanel
                kicker="Setup"
                title="Switch accounts safely"
                listLabel="Setup steps"
                listRole="tablist"
                badge={
                  <span className={`pill ${needsAttentionCount ? "pill-soft" : "pill-ok"}`}>
                    {needsAttentionCount
                      ? `${needsAttentionCount} action${needsAttentionCount === 1 ? "" : "s"}`
                      : "Ready"}
                  </span>
                }
                note="Manage Claude Code, Codex CLI, and Gemini CLI identities from one local control app."
                meta={
                  <div className="onboarding-welcome-stack">
                    <ul className="onboarding-trust-list" aria-label="Why AI Switch is safe to use">
                      {trustRows.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <button
                      className="link-button onboarding-link-button"
                      type="button"
                      onClick={() => onOpenSettings("keyring")}
                    >
                      How credentials stay local
                    </button>
                    <div className="onboarding-overview-meta">
                      <div>
                        <span className="overview-current-set-cell-label">Installed now</span>
                        <strong>
                          {installedNow.length ? (
                            <span className="tool-brand-list">
                              {installedNow.map((tool) => (
                                <ToolBrand
                                  key={tool}
                                  tool={tool}
                                  className="tool-brand-inline"
                                  logoSize={15}
                                />
                              ))}
                            </span>
                          ) : (
                            "No supported tools detected yet"
                          )}
                        </strong>
                        <p className="inline-note">Missing tools are optional. You can finish setup and add them later.</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Ready to switch</span>
                        <strong>{switchReady ? "Yes" : "Not yet"}</strong>
                        <p className="inline-note">
                          {switchReady
                            ? "At least one reusable profile is ready for a first switch."
                            : "Save one profile first, then try the first shared switch."}
                        </p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Desktop engine</span>
                        <strong>{runtimeReadinessLabel(bootstrap.runtime_status.compatible, "sentence")}</strong>
                        <p className="inline-note">Version {bootstrap.runtime_status.version?.version ?? "unknown"}</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Secure storage</span>
                        <strong>{secureStorage.startsWith("Secure storage has not") ? "Not confirmed" : "Available"}</strong>
                        <p className="inline-note">{secureStorage}</p>
                      </div>
                    </div>
                  </div>
                }
              >
                {setupSteps.map((step) => (
                  <button
                    key={step.value}
                    type="button"
                    role="tab"
                    aria-label={step.label}
                    aria-describedby={`setup-step-summary-${step.value}`}
                    aria-selected={activeStep === step.value}
                    className={`desktop-source-row onboarding-step-row ${
                      activeStep === step.value ? "desktop-source-row-selected" : ""
                    }`}
                    onClick={() => setActiveStep(step.value)}
                  >
                    <div className="onboarding-step-row-main">
                      <strong>{step.label}</strong>
                      <p
                        id={`setup-step-summary-${step.value}`}
                        className="inline-note"
                      >
                        {setupStepSummary(step.value)}
                      </p>
                    </div>
                    <span className="desktop-source-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </SourceListPanel>
            </article>
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
            {activeStep === "runtime" ? (
              <>
                <article className="diagnostic-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Welcome</p>
                      <h3>Desktop engine</h3>
                    </div>
                    <span className={`pill ${bootstrap.runtime_status.compatible ? "pill-ok" : "pill-soft"}`}>
                      {runtimeReadinessLabel(bootstrap.runtime_status.compatible, "sentence")}
                    </span>
                  </div>
                  <p className="inline-note">
                    AI Switch already includes the desktop engine it needs. You do not need
                    a separate command-line install to finish setup.
                  </p>
                  <p className="inline-note">{currentRuntimeSummary.description}</p>
                  <p className="inline-note">
                    If you already use a command-line switching tool, you can keep it installed.
                    AI Switch Desktop stays on its included engine unless you deliberately override it.
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
                          ? "Switching to Included Engine…"
                          : "Use Included Engine"}
                      </button>
                    ) : null}
                    <button className="ghost-button" type="button" onClick={() => onOpenSettings("runtime")}>
                      Engine Settings
                    </button>
                  </div>
                  {restoreBundledRuntimeMutation.error ? (
                    <p className="inline-note">
                      {restoreBundledRuntimeMutation.error instanceof Error
                        ? restoreBundledRuntimeMutation.error.message
                        : "Could not switch back to the included desktop engine."}
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
                      <p className="diagnostic-status diagnostic-status-pass">2. Try one switch</p>
                      <p className="inline-note">
                        Re-apply one saved set once so you know switching works before you start coding.
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
                        Run the setup scan to populate desktop engine, storage, and tool health details.
                      </p>
                    ) : null}
                  </div>
                </article>
              </>
            ) : null}

            {activeStep === "accounts" ? (
              <>
                <div className="desktop-pane-section onboarding-detection-stack">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">Accounts</p>
                      <h3>Detected tools</h3>
                    </div>
                    <p className="inline-note">
                      Save current logins as reusable profiles, add missing profiles where needed, and ignore
                      tools you do not use yet.
                    </p>
                  </div>
                  {accountItems.length ? (
                    <SplitView
                      className="onboarding-account-layout"
                      primaryClassName="onboarding-account-list-pane"
                      secondaryClassName="onboarding-account-detail-pane"
                      primary={
                        <article className="diagnostic-card onboarding-account-list-card">
                          <div className="desktop-pane-section-header">
                            <div>
                              <p className="card-kicker">Detected tools</p>
                              <h4>Choose one tool</h4>
                            </div>
                            <span className="pill pill-soft">
                              {accountItems.length} item{accountItems.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="desktop-source-list" aria-label="Detected tools">
                            {accountItems.map((item) => {
                              const tool =
                                item.kind === "live" ? item.account.tool : item.status.tool;
                              const title = toolDisplayName(tool);
                              const summary =
                                item.kind === "live"
                                  ? `${item.account.outcome ?? "unknown"} · ${item.account.auth_method ?? "unknown"}${item.account.matched_profile ? ` · matches ${item.account.matched_profile}` : ""}`
                                  : item.kind === "needs-profile"
                                    ? "No saved profile yet"
                                    : "Not installed yet";
                              const badgeClass =
                                item.kind === "live"
                                  ? "pill-ok"
                                  : "pill-soft";
                              const badgeLabel =
                                item.kind === "live"
                                  ? "Ready to import"
                                  : item.kind === "needs-profile"
                                    ? "Needs profile"
                                    : "Not installed";

                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  className={`desktop-source-row onboarding-account-row ${
                                    selectedAccountItem?.key === item.key
                                      ? "desktop-source-row-selected"
                                      : ""
                                  }`}
                                  aria-label={`Inspect ${title}`}
                                  aria-pressed={selectedAccountItem?.key === item.key}
                                  onClick={() => setSelectedAccountKey(item.key)}
                                >
                                  <div className="onboarding-account-row-main">
                                    <strong>
                                      <ToolBrand tool={tool} className="tool-brand-inline" logoSize={16} />
                                    </strong>
                                    <p className="inline-note">{summary}</p>
                                  </div>
                                  <div className="settings-nav-row-meta">
                                    <span className={`pill ${badgeClass}`}>{badgeLabel}</span>
                                    <span className="desktop-source-chevron" aria-hidden="true">
                                      ›
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </article>
                      }
                      secondary={
                        selectedAccountItem ? (
                          <article
                            className={`diagnostic-card onboarding-account-detail-card ${
                              selectedAccountItem.kind === "missing" ? "diagnostic-warn" : ""
                            }`}
                          >
                            {selectedAccountItem.kind === "live" ? (
                              <>
                                <div className="desktop-pane-section-header">
                                  <div>
                                    <p className="card-kicker">Detected login</p>
                                    <h3>
                                      <ToolBrand tool={selectedAccountItem.account.tool} className="tool-brand-heading" logoSize={18} />
                                    </h3>
                                  </div>
                                  <span className="pill pill-ok">Ready to import</span>
                                </div>
                                <div className="onboarding-account-summary">
                                  <div>
                                    <span className="overview-current-set-cell-label">Status</span>
                                    <strong>{selectedAccountItem.account.outcome ?? "unknown"}</strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">Sign-in method</span>
                                    <strong>{selectedAccountItem.account.auth_method ?? "unknown"}</strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">Matched profile</span>
                                    <strong>{selectedAccountItem.account.matched_profile ?? "Not matched yet"}</strong>
                                  </div>
                                </div>
                                {!supportsProfileImportMode(selectedAccountItem.account.tool, toolCapabilities, "from_live") ? (
                                  <p className="inline-note">
                                    This release cannot save the current {toolDisplayName(selectedAccountItem.account.tool)} login directly.
                                    Choose another sign-in method instead.
                                  </p>
                                ) : (
                                  <p className="inline-note">
                                    Save the current {toolDisplayName(selectedAccountItem.account.tool)} login as a reusable profile in a
                                    setup sheet.
                                  </p>
                                )}
                                <div className="button-row">
                                  {supportsProfileImportMode(selectedAccountItem.account.tool, toolCapabilities, "from_live") ? (
                                    <button
                                      className="ghost-button"
                                      type="button"
                                      disabled={mutationLock.isBusy}
                                      onClick={() => openLiveImport(selectedAccountItem.account)}
                                    >
                                      Import as profile
                                    </button>
                                  ) : (
                                    <button
                                      className="ghost-button"
                                      type="button"
                                      disabled={mutationLock.isBusy}
                                      onClick={() =>
                                        onOpenProfiles(selectedAccountItem.account.tool, {
                                          mode: preferredProfileImportMode(selectedAccountItem.account.tool, toolCapabilities, "from_live"),
                                        })
                                      }
                                    >
                                      Choose sign-in method
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : null}

                            {selectedAccountItem.kind === "needs-profile" ? (
                              <>
                                <div className="desktop-pane-section-header">
                                  <div>
                                    <p className="card-kicker">Saved profile needed</p>
                                    <h3>
                                      <ToolBrand tool={selectedAccountItem.status.tool} className="tool-brand-heading" logoSize={18} />
                                    </h3>
                                  </div>
                                  <span className="pill pill-soft">Needs profile</span>
                                </div>
                                <div className="onboarding-account-summary">
                                  <div>
                                    <span className="overview-current-set-cell-label">Status</span>
                                    <strong>Installed, but no saved profile yet</strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">Current state</span>
                                    <strong>No reusable account saved</strong>
                                  </div>
                                </div>
                                <p className="inline-note">
                                  Add one reusable {toolDisplayName(selectedAccountItem.status.tool)} profile so this computer can switch that tool safely later.
                                </p>
                                <div className="button-row">
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    aria-label={`Add ${selectedAccountItem.status.tool} profile`}
                                    disabled={mutationLock.isBusy}
                                    onClick={() => onOpenProfiles(selectedAccountItem.status.tool)}
                                  >
                                    Add profile
                                  </button>
                                </div>
                              </>
                            ) : null}

                            {selectedAccountItem.kind === "missing" ? (
                              <>
                                <div className="desktop-pane-section-header">
                                  <div>
                                    <p className="card-kicker">Optional tool</p>
                                    <h3>{toolDisplayName(selectedAccountItem.status.tool)} is not installed</h3>
                                  </div>
                                  <span className="pill pill-soft">Not installed</span>
                                </div>
                                <p className="inline-note">
                                  <ToolBrand tool={selectedAccountItem.status.tool} className="tool-brand-inline" logoSize={16} />
                                </p>
                                <div className="onboarding-account-summary">
                                  <div>
                                    <span className="overview-current-set-cell-label">Status</span>
                                    <strong>Optional for now</strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">Binary</span>
                                    <strong>{toolBinaryName(selectedAccountItem.status.tool)}</strong>
                                  </div>
                                </div>
                                <p className="inline-note">
                                  You can finish setup without {toolDisplayName(selectedAccountItem.status.tool)}. Install the{" "}
                                  <code>{toolBinaryName(selectedAccountItem.status.tool)}</code> tool later when you want to manage that provider here.
                                </p>
                                <div className="button-row">
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={() => openExternalGuide(installGuideUrlForTool(selectedAccountItem.status.tool))}
                                  >
                                    Open installation guide
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </article>
                        ) : null
                      }
                    />
                  ) : (
                    <p className="inline-note">
                      Run the setup scan to detect live Claude, Codex, and Gemini accounts.
                    </p>
                  )}
                </div>
              </>
            ) : null}

            {activeStep === "switch" ? (
              <article className="diagnostic-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">First switch</p>
                    <h3>Try one safe switch</h3>
                  </div>
                  <p className="inline-note">
                    Re-apply one saved set across installed tools so you know switching works
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
                        Open Profiles
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
                  This app writes live credential files directly. Most people can skip this and
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

            {activeStep === "done" ? (
              <article className="diagnostic-card onboarding-complete-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Done</p>
                    <h3>You&apos;re ready</h3>
                  </div>
                  <span className={`pill ${switchReady ? "pill-ok" : "pill-soft"}`}>
                    {switchReady ? "Ready to switch" : "Setup can continue later"}
                  </span>
                </div>
                <p className="inline-note">
                  AI Switch is ready to manage saved local accounts on this computer. Missing tools stay optional,
                  and you can add more profiles whenever you need them.
                </p>
                <div className="onboarding-complete-grid" aria-label="Setup completion status">
                  {snapshot.statuses.map((status) => {
                    const profileCount = snapshot.profiles[status.tool]?.profiles.length ?? 0;
                    const state =
                      !status.binary_found
                        ? "Not installed"
                        : status.active_profile
                          ? status.active_profile
                          : profileCount > 0
                            ? `${profileCount} saved profile${profileCount === 1 ? "" : "s"}`
                            : "Not configured";
                    return (
                      <div key={status.tool} className="onboarding-complete-cell">
                        <span className="overview-current-set-cell-label">
                          <ToolBrand tool={status.tool} className="tool-brand-inline" logoSize={15} />
                        </span>
                        <strong>{state}</strong>
                        <p className="inline-note">
                          {!status.binary_found
                            ? "Optional for now."
                            : status.active_profile
                              ? "Active on this computer."
                              : profileCount > 0
                                ? "Saved locally and ready when needed."
                                : "Add a profile later from Profiles."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : null}

            <article className="diagnostic-card onboarding-step-footer-card">
              <div className="onboarding-step-footer-copy">
                <p className="card-kicker">
                  Step {activeStepIndex + 1} of {setupSteps.length}
                </p>
                <h3>{setupStepFooterTitle(activeStep)}</h3>
                <p className="inline-note">{setupStepFooterNote(activeStep, switchReady)}</p>
              </div>
              <div className="button-row onboarding-step-footer-actions">
                {previousStep ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setActiveStep(previousStep.value)}
                  >
                    Back
                  </button>
                ) : null}
                {nextStep ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setActiveStep(nextStep.value)}
                  >
                    Continue to {nextStep.label}
                  </button>
                ) : forcedOpen ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={onCloseSetup}
                  >
                    Close setup
                  </button>
                ) : null}
              </div>
            </article>
          </div>
        }
      />
      {pendingLiveImport ? (
        <DialogSurface
          ariaLabel={`Import ${toolDisplayName(pendingLiveImport.tool)} Profile`}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="input:not([disabled]), button:not([disabled])"
          onClose={closeLiveImport}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Import current account</p>
                <h3>
                  Import <ToolBrand tool={pendingLiveImport.tool} className="tool-brand-inline" logoSize={18} shortName /> profile
                </h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeLiveImport}>
                Close
              </button>
            </div>
            <p className="inline-note">
              Save the account that {toolDisplayName(pendingLiveImport.tool)} is already using as a
              reusable profile. This imported profile becomes the active saved account for this tool.
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
        </DialogSurface>
      ) : null}
    </div>
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

function setupStepSummary(step: SetupStep) {
  switch (step) {
    case "runtime":
      return "Confirm the included desktop engine, data folder, and secure storage.";
    case "accounts":
      return "Import current logins or add the first saved profiles you need.";
    case "switch":
      return "Run one safe set switch before you start coding.";
    case "terminal":
      return "Optional setup for already-open terminal sessions.";
    case "done":
      return "Review what is ready now and what can wait until later.";
  }
}

function setupStepFooterTitle(step: SetupStep) {
  switch (step) {
    case "runtime":
      return "Confirm the included desktop engine";
    case "accounts":
      return "Save at least one reusable account";
    case "switch":
      return "Run a safe first switch";
    case "terminal":
      return "Leave terminal integration for later unless you need it";
    case "done":
      return "Review the local setup summary";
  }
}

function setupStepFooterNote(step: SetupStep, switchReady: boolean) {
  switch (step) {
    case "runtime":
      return "Use the included desktop engine unless you intentionally want AI Switch to point at another managed engine.";
    case "accounts":
      return "Imported current logins and saved profiles are what make safe switching possible later.";
    case "switch":
      return switchReady
        ? "Re-apply one saved set once so you know switching works before you start coding."
        : "You can continue, but you will need one saved set name before the first switch can succeed.";
    case "terminal":
      return "The app already updates local credential files directly. Shell integration is only for already-open terminal sessions.";
    case "done":
      return "You can reopen setup later from Settings if you want to finish optional tools or terminal integration.";
  }
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
      label: "Desktop engine",
      status: bootstrap.runtime_status.compatible ? "pass" : "fail",
      detail: bootstrap.runtime_status.compatible
        ? bootstrap.settings.runtime_kind === "bundled"
          ? "Included desktop engine is compatible with this app."
          : "Selected engine override is compatible with this app."
        : normalizeRuntimeLanguage(bootstrap.runtime_status.issues.join(" · ")) || "Compatibility checks failed.",
    },
  ];

  doctorChecks.forEach((entry) => {
    const check = entry as { name?: string; status?: string; detail?: string };
    const status =
      check.status === "pass" || check.status === "warn" || check.status === "fail"
        ? check.status
        : "warn";
    items.push({
      label: normalizeSetupHealthLabel(check.name),
      status,
      detail: normalizeSetupHealthDetail(check.detail),
    });
  });

  snapshot.statuses.forEach((status) => {
    items.push({
      label: `${toolDisplayName(status.tool)} availability`,
      status: status.binary_found ? "pass" : "fail",
      detail: status.binary_found
        ? `${toolDisplayName(status.tool)} detected${status.active_profile ? ` · active ${status.active_profile}` : ""}.`
        : `${toolDisplayName(status.tool)} binary was not detected on PATH or in live state.`,
    });
  });

  return items;
}

function selectDefaultAccountItem(items: OnboardingAccountItem[]) {
  return (
    items.find((item) => item.kind === "live") ??
    items.find((item) => item.kind === "missing") ??
    items.find((item) => item.kind === "needs-profile") ??
    null
  );
}

function buildRuntimeRows(
  bootstrap: AppBootstrap,
  snapshot: AppSnapshot,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
): HealthItem[] {
  return [
    {
      label: "Desktop engine",
      status: bootstrap.runtime_status.compatible ? "pass" : "warn",
      detail: bootstrap.settings.runtime_kind === "bundled"
        ? `Ready. Version ${bootstrap.runtime_status.version?.version ?? "unknown"}.`
        : `Available, but AI Switch is currently using ${runtimeSummary(bootstrap.settings.runtime_kind).source.toLowerCase()}.`,
    },
    {
      label: "Data folder",
      status: "pass",
      detail: bootstrap.settings.aisw_home
        ? `Custom data folder set to ${bootstrap.settings.aisw_home}.`
        : "Managed automatically inside the standard AI Switch data location.",
    },
    {
      label: "Secure storage",
      status: supportsSecureStorage(snapshot, toolCapabilities) ? "pass" : "warn",
      detail: describeSecureStorage(snapshot, toolCapabilities),
    },
  ];
}

function normalizeSetupHealthLabel(value: string | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!normalized) {
    return "Setup check";
  }
  if (normalized.includes("shell")) {
    return "Terminal integration";
  }
  if (normalized.includes("keyring")) {
    return "Secure storage";
  }
  if (normalized.includes("permission")) {
    return "Local permissions";
  }
  if (normalized.includes("oauth")) {
    return "Sign-in flow";
  }
  if (normalized.includes("backup")) {
    return "Backups";
  }
  if (normalized.includes("runtime") || normalized.includes("engine")) {
    return "Desktop engine";
  }
  return titleCase(normalized);
}

function normalizeSetupHealthDetail(value: string | undefined) {
  return normalizeTerminalIntegrationText(normalizeRuntimeLanguage(value ?? "No detail provided."));
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
