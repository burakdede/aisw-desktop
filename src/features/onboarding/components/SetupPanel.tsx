import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DialogSurface } from "../../../components/DialogSurface";
import { SourceListPanel } from "../../../components/SourceListPanel";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { getShellGuidance, runDoctor, updateSettings } from "../../../lib/client";
import { buildBundledRuntimeSettingsUpdate } from "../../../lib/desktop-settings";
import { sharedProfileEntries } from "../../../lib/profile-display";
import {
  runtimeReadinessLabel,
  runtimeSummary,
} from "../../../lib/runtime-display";
import { AppBootstrap, AppSnapshot, InitReport } from "../../../lib/schemas";
import { toolSupportsEditableStateModes } from "../../../lib/tool-registry";
import { toolDisplayName } from "../../../lib/tool-display";
import { countLabel } from "../../../lib/utils";
import {
  installGuideUrlForTool,
  openExternalGuide,
  toolBinaryName,
} from "../../../lib/tool-guidance";
import { SETTINGS_SECTION_IDS, type SettingsSection } from "../../../lib/settings-sections";
import {
  DEFAULT_PROFILE_IMPORT_MODE,
  preferredProfileImportMode,
  supportsProfileImportMode,
} from "../../shared/profile-capabilities";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { invalidatePostMutationQueries } from "../../shared/postMutationRefresh";
import {
  ONBOARDING_ACCOUNTS_STEP_COPY,
  ONBOARDING_DONE_STEP_COPY,
  ONBOARDING_IMPORT_DIALOG_COPY,
  ONBOARDING_TRUST_ROWS,
  ONBOARDING_RUNTIME_NEXT_STEPS,
  ONBOARDING_RUNTIME_STEP_COPY,
  ONBOARDING_SETUP_SCREEN_COPY,
  ONBOARDING_STEP_FOOTER_COPY,
  ONBOARDING_SWITCH_STEP_COPY,
  ONBOARDING_TERMINAL_STEP_COPY,
  accountItemTool,
  buildOnboardingInventory,
  onboardingCompletionState,
  onboardingContinueLabel,
  onboardingDetectedShellSummary,
  onboardingDoneBadgeLabel,
  buildOnboardingHealthItems,
  onboardingHealthStatusSymbol,
  buildOnboardingRuntimeRows,
  defaultSetupStep,
  onboardingImportedProfileLabel,
  onboardingImportSubmitLabel,
  onboardingPrimaryActionLabel,
  onboardingAccountBadge,
  onboardingAccountSummary,
  onboardingImportDialogAriaLabel,
  onboardingSecureStorageStatus,
  onboardingStepProgressLabel,
  onboardingSwitchSubmitLabel,
  onboardingSwitchReadinessStatus,
  onboardingLiveAccountImportNote,
  onboardingMissingToolHeading,
  onboardingMissingToolNoteParts,
  onboardingNeedsProfileNote,
  restoreIncludedEngineActionLabel,
  restoreIncludedEngineErrorMessage,
  resolveOnboardingStepState,
  resolveSelectedOnboardingAccountItem,
  selectDefaultAccountItem,
  setupStepFooterNote,
  setupStepFooterTitle,
  setupStepSummary,
  shouldShowSetupFlow,
  type LiveAccount,
  type SetupStep,
} from "../onboarding-display";
import type { ProfileImportMode } from "../../shared/profile-capabilities";

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
  const onboardingInventory = useMemo(
    () => buildOnboardingInventory(snapshot, initReport),
    [initReport, snapshot],
  );
  const {
    liveAccounts,
    installedToolsNeedingProfile,
    missingTools,
    accountItems,
    installedNow,
    needsAttentionCount,
  } = onboardingInventory;
  const healthItems = useMemo(
    () => buildOnboardingHealthItems(bootstrap, snapshot, doctor.data),
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
    mutationFn: async () => updateSettings(buildBundledRuntimeSettingsUpdate(settings)),
    onSuccess: async () => {
      await invalidatePostMutationQueries(queryClient);
    },
  });
  const pendingProfileName = pendingLiveImport ? profileNames[pendingLiveImport.tool] ?? "" : "";
  const pendingProfileLabel = pendingLiveImport ? profileLabels[pendingLiveImport.tool] ?? "" : "";
  const setupPrimaryActionLabel = onboardingPrimaryActionLabel(
    initMutation.isPending,
    initReport,
  );
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(() =>
    selectDefaultAccountItem(accountItems)?.key ?? null,
  );

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
      [pendingLiveImport.tool]: onboardingImportedProfileLabel(name),
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
    if (!supportsProfileImportMode(tool, toolCapabilities, DEFAULT_PROFILE_IMPORT_MODE)) {
      onOpenProfiles(tool, {
        mode: preferredProfileImportMode(
          tool,
          toolCapabilities,
          DEFAULT_PROFILE_IMPORT_MODE,
        ),
      });
      return;
    }
    addProfileMutation.mutate({
      tool,
      profile: value,
      label: profileLabels[tool]?.trim() || onboardingImportedProfileLabel(value),
      stateMode: toolSupportsEditableStateModes(tool) ? "isolated" : null,
      importMode: { kind: DEFAULT_PROFILE_IMPORT_MODE },
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

  useEffect(() => {
    if (!selectedAccountKey && !accountItems.length) {
      return;
    }
    if (selectedAccountKey && accountItems.some((item) => item.key === selectedAccountKey)) {
      return;
    }
    setSelectedAccountKey(selectDefaultAccountItem(accountItems)?.key ?? null);
  }, [accountItems, selectedAccountKey]);

  if (!shouldShowSetup) {
    return null;
  }

  const { steps: setupSteps, activeStepIndex, previousStep, nextStep } =
    resolveOnboardingStepState(activeStep);
  const switchReady = switchableProfiles.length > 0;
  const switchReadiness = onboardingSwitchReadinessStatus(switchReady);
  const secureStorage = onboardingSecureStorageStatus(snapshot, toolCapabilities);
  const currentRuntimeSummary = runtimeSummary(settings.runtime_kind);
  const runtimeRows = buildOnboardingRuntimeRows(bootstrap, snapshot, toolCapabilities);

  const selectedAccountItem = resolveSelectedOnboardingAccountItem(
    accountItems,
    selectedAccountKey,
  );
  const selectedLiveImportSupported =
    selectedAccountItem?.kind === "live"
      ? supportsProfileImportMode(
          selectedAccountItem.account.tool,
          toolCapabilities,
          DEFAULT_PROFILE_IMPORT_MODE,
        )
      : false;
  const selectedMissingToolNoteParts =
    selectedAccountItem?.kind === "missing"
      ? onboardingMissingToolNoteParts(selectedAccountItem.status.tool)
      : null;

  return (
    <div className="setup-screen screen-content">
      <div className="setup-screen-toolbar">
        <div className="setup-screen-toolbar-copy">
          <h2 className="visually-hidden">Get started</h2>
          <span className="setup-screen-kicker">{ONBOARDING_SETUP_SCREEN_COPY.toolbarKicker}</span>
          <p className="inline-note">{ONBOARDING_SETUP_SCREEN_COPY.toolbarNote}</p>
        </div>
        <div className="button-row setup-screen-toolbar-actions">
          {forcedOpen ? (
            <button className="ghost-button" type="button" onClick={onCloseSetup}>
              {ONBOARDING_SETUP_SCREEN_COPY.closeLabel}
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
                      ? countLabel(needsAttentionCount, "action")
                      : "Ready"}
                  </span>
                }
                note="Manage Claude Code, Codex CLI, and Gemini CLI identities from one local control app."
                meta={
                  <div className="onboarding-welcome-stack">
                    <ul className="onboarding-trust-list" aria-label="Why AI Switch is safe to use">
                      {ONBOARDING_TRUST_ROWS.map((item) => (
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
                        <strong>{switchReadiness.label}</strong>
                        <p className="inline-note">{switchReadiness.detail}</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Desktop engine</span>
                        <strong>{runtimeReadinessLabel(bootstrap.runtime_status.compatible, "sentence")}</strong>
                        <p className="inline-note">Version {bootstrap.runtime_status.version?.version ?? "unknown"}</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Secure storage</span>
                        <strong>{secureStorage.label}</strong>
                        <p className="inline-note">{secureStorage.detail}</p>
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
                      <p className="card-kicker">{ONBOARDING_RUNTIME_STEP_COPY.welcomeKicker}</p>
                      <h3>{ONBOARDING_RUNTIME_STEP_COPY.welcomeHeading}</h3>
                    </div>
                    <span className={`pill ${bootstrap.runtime_status.compatible ? "pill-ok" : "pill-soft"}`}>
                      {runtimeReadinessLabel(bootstrap.runtime_status.compatible, "sentence")}
                    </span>
                  </div>
                  <p className="inline-note">{ONBOARDING_RUNTIME_STEP_COPY.welcomePrimaryNote}</p>
                  <p className="inline-note">{currentRuntimeSummary.description}</p>
                  <p className="inline-note">{ONBOARDING_RUNTIME_STEP_COPY.welcomeSecondaryNote}</p>
                  <div className="stack-list">
                    {runtimeRows.map((item) => (
                      <div key={item.label}>
                        <p className={`diagnostic-status diagnostic-status-${item.status}`}>
                          {onboardingHealthStatusSymbol(item.status)} {item.label}
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
                        {restoreIncludedEngineActionLabel(
                          restoreBundledRuntimeMutation.isPending,
                        )}
                      </button>
                    ) : null}
                    <button className="ghost-button" type="button" onClick={() => onOpenSettings("runtime")}>
                      {ONBOARDING_RUNTIME_STEP_COPY.settingsButtonLabel}
                    </button>
                  </div>
                  {restoreBundledRuntimeMutation.error ? (
                    <p className="inline-note">
                      {restoreIncludedEngineErrorMessage(
                        restoreBundledRuntimeMutation.error,
                      )}
                    </p>
                  ) : null}
                </article>

                <article className="diagnostic-card">
                  <div className="desktop-pane-section-header">
                    <div>
                      <p className="card-kicker">{ONBOARDING_RUNTIME_STEP_COPY.nextKicker}</p>
                      <h3>{ONBOARDING_RUNTIME_STEP_COPY.nextHeading}</h3>
                    </div>
                  </div>
                  <div className="stack-list">
                    {ONBOARDING_RUNTIME_NEXT_STEPS.map((item) => (
                      <div key={item.label}>
                        <p className="diagnostic-status diagnostic-status-pass">{item.label}</p>
                        <p className="inline-note">{item.detail}</p>
                      </div>
                    ))}
                    {healthItems.map((item) => (
                      <div key={item.label}>
                        <p className={`diagnostic-status diagnostic-status-${item.status}`}>
                          {onboardingHealthStatusSymbol(item.status)} {item.label}
                        </p>
                        <p className="inline-note">{item.detail}</p>
                      </div>
                    ))}
                    {!healthItems.length ? (
                      <p className="inline-note">{ONBOARDING_RUNTIME_STEP_COPY.healthFallback}</p>
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
                      <p className="card-kicker">{ONBOARDING_ACCOUNTS_STEP_COPY.sectionKicker}</p>
                      <h3>{ONBOARDING_ACCOUNTS_STEP_COPY.sectionHeading}</h3>
                    </div>
                    <p className="inline-note">{ONBOARDING_ACCOUNTS_STEP_COPY.sectionNote}</p>
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
                              <p className="card-kicker">{ONBOARDING_ACCOUNTS_STEP_COPY.listKicker}</p>
                              <h4>{ONBOARDING_ACCOUNTS_STEP_COPY.listHeading}</h4>
                            </div>
                            <span className="pill pill-soft">
                              {countLabel(accountItems.length, "item")}
                            </span>
                          </div>
                          <div className="desktop-source-list" aria-label={ONBOARDING_ACCOUNTS_STEP_COPY.listAriaLabel}>
                            {accountItems.map((item) => {
                              const tool = accountItemTool(item);
                              const title = toolDisplayName(tool);
                              const badge = onboardingAccountBadge(item);
                              const summary = onboardingAccountSummary(item);

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
                                    <span className={`pill pill-${badge.tone}`}>{badge.label}</span>
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
                                    <p className="card-kicker">{ONBOARDING_ACCOUNTS_STEP_COPY.liveKicker}</p>
                                    <h3>
                                      <ToolBrand tool={selectedAccountItem.account.tool} className="tool-brand-heading" logoSize={18} />
                                    </h3>
                                  </div>
                                  <span className={`pill pill-${onboardingAccountBadge(selectedAccountItem).tone}`}>
                                    {onboardingAccountBadge(selectedAccountItem).label}
                                  </span>
                                </div>
                                <div className="onboarding-account-summary">
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.liveStatusLabel}
                                    </span>
                                    <strong>
                                      {selectedAccountItem.account.outcome ??
                                        ONBOARDING_ACCOUNTS_STEP_COPY.unknownValue}
                                    </strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.liveSignInMethodLabel}
                                    </span>
                                    <strong>
                                      {selectedAccountItem.account.auth_method ??
                                        ONBOARDING_ACCOUNTS_STEP_COPY.unknownValue}
                                    </strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.liveMatchedProfileLabel}
                                    </span>
                                    <strong>
                                      {selectedAccountItem.account.matched_profile ??
                                        ONBOARDING_ACCOUNTS_STEP_COPY.unmatchedProfileLabel}
                                    </strong>
                                  </div>
                                </div>
                                <p className="inline-note">
                                  {onboardingLiveAccountImportNote(
                                    selectedAccountItem.account.tool,
                                    selectedLiveImportSupported,
                                  )}
                                </p>
                                <div className="button-row">
                                  {selectedLiveImportSupported ? (
                                    <button
                                      className="ghost-button"
                                      type="button"
                                      disabled={mutationLock.isBusy}
                                      onClick={() => openLiveImport(selectedAccountItem.account)}
                                    >
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.importActionLabel}
                                    </button>
                                  ) : (
                                    <button
                                      className="ghost-button"
                                      type="button"
                                      disabled={mutationLock.isBusy}
                                      onClick={() =>
                                        onOpenProfiles(selectedAccountItem.account.tool, {
                                          mode: preferredProfileImportMode(
                                            selectedAccountItem.account.tool,
                                            toolCapabilities,
                                            DEFAULT_PROFILE_IMPORT_MODE,
                                          ),
                                        })
                                      }
                                    >
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.chooseSignInMethodLabel}
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : null}

                            {selectedAccountItem.kind === "needs-profile" ? (
                              <>
                                <div className="desktop-pane-section-header">
                                  <div>
                                    <p className="card-kicker">{ONBOARDING_ACCOUNTS_STEP_COPY.needsProfileKicker}</p>
                                    <h3>
                                      <ToolBrand tool={selectedAccountItem.status.tool} className="tool-brand-heading" logoSize={18} />
                                    </h3>
                                  </div>
                                  <span className={`pill pill-${onboardingAccountBadge(selectedAccountItem).tone}`}>
                                    {onboardingAccountBadge(selectedAccountItem).label}
                                  </span>
                                </div>
                                <div className="onboarding-account-summary">
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.needsProfileStatusLabel}
                                    </span>
                                    <strong>{ONBOARDING_ACCOUNTS_STEP_COPY.needsProfileStatusValue}</strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.needsProfileCurrentStateLabel}
                                    </span>
                                    <strong>{ONBOARDING_ACCOUNTS_STEP_COPY.needsProfileCurrentStateValue}</strong>
                                  </div>
                                </div>
                                <p className="inline-note">{onboardingNeedsProfileNote(selectedAccountItem.status.tool)}</p>
                                <div className="button-row">
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    aria-label={`Add ${selectedAccountItem.status.tool} profile`}
                                    disabled={mutationLock.isBusy}
                                    onClick={() => onOpenProfiles(selectedAccountItem.status.tool)}
                                  >
                                    {ONBOARDING_ACCOUNTS_STEP_COPY.addProfileActionLabel}
                                  </button>
                                </div>
                              </>
                            ) : null}

                            {selectedAccountItem.kind === "missing" ? (
                              <>
                                <div className="desktop-pane-section-header">
                                  <div>
                                    <p className="card-kicker">{ONBOARDING_ACCOUNTS_STEP_COPY.missingKicker}</p>
                                    <h3>{onboardingMissingToolHeading(selectedAccountItem.status.tool)}</h3>
                                  </div>
                                  <span className={`pill pill-${onboardingAccountBadge(selectedAccountItem).tone}`}>
                                    {onboardingAccountBadge(selectedAccountItem).label}
                                  </span>
                                </div>
                                <p className="inline-note">
                                  <ToolBrand tool={selectedAccountItem.status.tool} className="tool-brand-inline" logoSize={16} />
                                </p>
                                <div className="onboarding-account-summary">
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.missingStatusLabel}
                                    </span>
                                    <strong>{ONBOARDING_ACCOUNTS_STEP_COPY.missingStatusValue}</strong>
                                  </div>
                                  <div>
                                    <span className="overview-current-set-cell-label">
                                      {ONBOARDING_ACCOUNTS_STEP_COPY.binaryLabel}
                                    </span>
                                    <strong>{toolBinaryName(selectedAccountItem.status.tool)}</strong>
                                  </div>
                                </div>
                                <p className="inline-note">
                                  {selectedMissingToolNoteParts?.beforeBinary}
                                  <code>{selectedMissingToolNoteParts?.binary}</code>
                                  {selectedMissingToolNoteParts?.afterBinary}
                                </p>
                                <div className="button-row">
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={() => openExternalGuide(installGuideUrlForTool(selectedAccountItem.status.tool))}
                                  >
                                    {ONBOARDING_ACCOUNTS_STEP_COPY.installationGuideLabel}
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </article>
                        ) : null
                      }
                    />
                  ) : (
                    <p className="inline-note">{ONBOARDING_ACCOUNTS_STEP_COPY.emptyDetail}</p>
                  )}
                </div>
              </>
            ) : null}

            {activeStep === "switch" ? (
              <article className="diagnostic-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">{ONBOARDING_SWITCH_STEP_COPY.kicker}</p>
                    <h3>{ONBOARDING_SWITCH_STEP_COPY.heading}</h3>
                  </div>
                  <p className="inline-note">{ONBOARDING_SWITCH_STEP_COPY.note}</p>
                </div>
                <div className="inline-form">
                  <select
                    aria-label={ONBOARDING_SWITCH_STEP_COPY.selectAriaLabel}
                    value={firstSwitchProfile}
                    onChange={(event) => setFirstSwitchProfile(event.target.value)}
                  >
                    <option value="">{ONBOARDING_SWITCH_STEP_COPY.selectPlaceholder}</option>
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
                    {onboardingSwitchSubmitLabel(useAllProfilesMutation.isPending)}
                  </button>
                </div>
                {!switchableProfiles.length ? (
                  <div className="stack-list">
                    <p className="inline-note">{ONBOARDING_SWITCH_STEP_COPY.emptyDetail}</p>
                    <div className="button-row">
                      <button className="ghost-button" type="button" onClick={() => onOpenProfiles("claude")}>
                        {ONBOARDING_SWITCH_STEP_COPY.openProfilesLabel}
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
                    <p className="card-kicker">{ONBOARDING_TERMINAL_STEP_COPY.kicker}</p>
                    <h3>{ONBOARDING_TERMINAL_STEP_COPY.heading}</h3>
                  </div>
                  <p className="inline-note">{ONBOARDING_TERMINAL_STEP_COPY.intro}</p>
                </div>
                {shellGuidance.data?.detected_shell ? (
                  <p className="inline-note">
                    <strong>{onboardingDetectedShellSummary(shellGuidance.data.detected_shell)}</strong>
                  </p>
                ) : null}
                <p className="inline-note">{ONBOARDING_TERMINAL_STEP_COPY.primaryDetail}</p>
                <p className="inline-note">{ONBOARDING_TERMINAL_STEP_COPY.secondaryDetail}</p>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => onOpenSettings("shell")}>
                    {ONBOARDING_TERMINAL_STEP_COPY.openSetupLabel}
                  </button>
                </div>
              </article>
            ) : null}

            {activeStep === "done" ? (
              <article className="diagnostic-card onboarding-complete-card">
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">{ONBOARDING_DONE_STEP_COPY.kicker}</p>
                    <h3>{ONBOARDING_DONE_STEP_COPY.heading}</h3>
                  </div>
                  <span className={`pill ${switchReady ? "pill-ok" : "pill-soft"}`}>
                    {onboardingDoneBadgeLabel(switchReady)}
                  </span>
                </div>
                <p className="inline-note">{ONBOARDING_DONE_STEP_COPY.note}</p>
                <div className="onboarding-complete-grid" aria-label={ONBOARDING_DONE_STEP_COPY.gridAriaLabel}>
                  {snapshot.statuses.map((status) => {
                    const profileCount = snapshot.profiles[status.tool]?.profiles.length ?? 0;
                    const completion = onboardingCompletionState(status, profileCount);
                    return (
                      <div key={status.tool} className="onboarding-complete-cell">
                        <span className="overview-current-set-cell-label">
                          <ToolBrand tool={status.tool} className="tool-brand-inline" logoSize={15} />
                        </span>
                        <strong>{completion.state}</strong>
                        <p className="inline-note">{completion.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : null}

            <article className="diagnostic-card onboarding-step-footer-card">
              <div className="onboarding-step-footer-copy">
                <p className="card-kicker">{onboardingStepProgressLabel(activeStepIndex, setupSteps.length)}</p>
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
                    {ONBOARDING_STEP_FOOTER_COPY.backLabel}
                  </button>
                ) : null}
                {nextStep ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setActiveStep(nextStep.value)}
                  >
                    {onboardingContinueLabel(nextStep.label)}
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
          ariaLabel={onboardingImportDialogAriaLabel(pendingLiveImport.tool)}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="input:not([disabled]), button:not([disabled])"
          onClose={closeLiveImport}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{ONBOARDING_IMPORT_DIALOG_COPY.kicker}</p>
                <h3>
                  {ONBOARDING_IMPORT_DIALOG_COPY.headingPrefix}{" "}
                  <ToolBrand tool={pendingLiveImport.tool} className="tool-brand-inline" logoSize={18} shortName />{" "}
                  {ONBOARDING_IMPORT_DIALOG_COPY.headingSuffix}
                </h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeLiveImport}>
                {ONBOARDING_IMPORT_DIALOG_COPY.closeLabel}
              </button>
            </div>
            <p className="inline-note">
              {ONBOARDING_IMPORT_DIALOG_COPY.introPrefix}
              {toolDisplayName(pendingLiveImport.tool)}
              {ONBOARDING_IMPORT_DIALOG_COPY.introSuffix}
            </p>
            <form className="stacked-form" onSubmit={(event) => submitImport(event, pendingLiveImport.tool)}>
              <label>
                {ONBOARDING_IMPORT_DIALOG_COPY.profileNameLabel}
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
                {ONBOARDING_IMPORT_DIALOG_COPY.labelFieldLabel}
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
                  {ONBOARDING_IMPORT_DIALOG_COPY.cancelLabel}
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={mutationLock.isBusy || addProfileMutation.isPending || !pendingProfileName.trim()}
                >
                  {onboardingImportSubmitLabel(addProfileMutation.isPending)}
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
