import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ButtonRow } from "../../../components/ButtonRow";
import {
  DIALOG_FOCUS_SELECTORS,
  DIALOG_SURFACE_CLASS_NAMES,
  DialogSurface,
} from "../../../components/DialogSurface";
import { PaneSectionHeader } from "../../../components/PaneSectionHeader";
import { SheetHeader } from "../../../components/SheetHeader";
import { SourceListPanel } from "../../../components/SourceListPanel";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { getShellGuidance, runDoctor, updateSettings } from "../../../lib/client";
import { buildBundledRuntimeSettingsUpdate } from "../../../lib/desktop-settings";
import { DESKTOP_QUERY_KEYS } from "../../../lib/desktop-query-keys";
import { sharedProfileEntries } from "../../../lib/profile-display";
import {
  runtimeReadinessLabel,
  runtimeSummary,
} from "../../../lib/runtime-display";
import { AppBootstrap, AppSnapshot, InitReport } from "../../../lib/schemas";
import { toolSupportsEditableStateModes } from "../../../lib/tool-registry";
import { toolDisplayName } from "../../../lib/tool-display";
import { countLabel, findMatchingItem } from "../../../lib/utils";
import { inspectItemLabel } from "../../../lib/display-copy";
import {
  installGuideUrlForTool,
  openExternalGuide,
} from "../../../lib/tool-guidance";
import { SETTINGS_SECTION_IDS, type SettingsSection } from "../../../lib/settings-sections";
import {
  DEFAULT_PROFILE_IMPORT_MODE,
} from "../../shared/profile-capabilities";
import { DEFAULT_EDITABLE_STATE_MODE, resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { invalidatePostMutationQueries } from "../../shared/postMutationRefresh";
import {
  ONBOARDING_ACCOUNTS_STEP_COPY,
  ONBOARDING_DONE_STEP_COPY,
  ONBOARDING_IMPORT_DIALOG_COPY,
  ONBOARDING_OVERVIEW_COPY,
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
  onboardingLiveImportAction,
  onboardingPrimaryActionLabel,
  onboardingAccountBadge,
  onboardingAccountSummary,
  onboardingImportDialogAriaLabel,
  onboardingOverviewBadgeLabel,
  onboardingSecureStorageStatus,
  onboardingStepProgressLabel,
  onboardingSwitchSubmitLabel,
  onboardingSwitchReadinessStatus,
  restoreIncludedEngineActionLabel,
  restoreIncludedEngineErrorMessage,
  buildSelectedOnboardingAccountDetailState,
  onboardingRuntimeVersionDetail,
  resolveOnboardingStepState,
  resolveSelectedOnboardingAccountKey,
  resolveSelectedOnboardingAccountItem,
  setupStepFooterNote,
  setupStepFooterTitle,
  setupStepSummary,
  shouldShowSetupFlow,
  type OnboardingAccountItem,
  type OnboardingAccountDetailState,
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
  const doctor = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.doctor,
    queryFn: runDoctor,
    enabled: readEnabled,
  });
  const shellGuidance = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.shellGuidance,
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
  const selectedSwitchProfile = useMemo(
    () => findMatchingItem(firstSwitchProfile, switchableProfiles, (profile) => profile.name),
    [firstSwitchProfile, switchableProfiles],
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
    resolveSelectedOnboardingAccountKey(accountItems, null),
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
    const importAction = onboardingLiveImportAction(tool, toolCapabilities);
    if (importAction.kind === "open_profiles") {
      onOpenProfiles(tool, {
        mode: importAction.mode,
      });
      return;
    }
    addProfileMutation.mutate({
      tool,
      profile: value,
      label: profileLabels[tool]?.trim() || onboardingImportedProfileLabel(value),
      stateMode: toolSupportsEditableStateModes(tool) ? DEFAULT_EDITABLE_STATE_MODE : null,
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
    const nextSelectedAccountKey = resolveSelectedOnboardingAccountKey(
      accountItems,
      selectedAccountKey,
    );
    if (nextSelectedAccountKey !== selectedAccountKey) {
      setSelectedAccountKey(nextSelectedAccountKey);
    }
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
  const selectedAccountDetail = selectedAccountItem
    ? buildSelectedOnboardingAccountDetailState(selectedAccountItem, toolCapabilities)
    : null;

  return (
    <div className="setup-screen screen-content">
      <div className="setup-screen-toolbar">
        <div className="setup-screen-toolbar-copy">
          <h2 className="visually-hidden">Get started</h2>
          <span className="setup-screen-kicker">{ONBOARDING_SETUP_SCREEN_COPY.toolbarKicker}</span>
          <p className="inline-note">{ONBOARDING_SETUP_SCREEN_COPY.toolbarNote}</p>
        </div>
        <ButtonRow className="setup-screen-toolbar-actions">
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
        </ButtonRow>
      </div>
      <SplitView
        className="onboarding-layout onboarding-layout-compact"
        primaryClassName="onboarding-summary-pane"
        secondaryClassName="onboarding-actions-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card onboarding-overview">
              <SourceListPanel
                kicker={ONBOARDING_OVERVIEW_COPY.kicker}
                title={ONBOARDING_OVERVIEW_COPY.heading}
                listLabel={ONBOARDING_OVERVIEW_COPY.listAriaLabel}
                listRole="tablist"
                badge={
                  <span className={`pill ${needsAttentionCount ? "pill-soft" : "pill-ok"}`}>
                    {onboardingOverviewBadgeLabel(needsAttentionCount)}
                  </span>
                }
                note={ONBOARDING_OVERVIEW_COPY.note}
                meta={
                  <div className="onboarding-welcome-stack">
                    <ul
                      className="onboarding-trust-list"
                      aria-label={ONBOARDING_OVERVIEW_COPY.trustListAriaLabel}
                    >
                      {ONBOARDING_TRUST_ROWS.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <button
                      className="link-button onboarding-link-button"
                      type="button"
                      onClick={() => onOpenSettings("keyring")}
                    >
                      {ONBOARDING_OVERVIEW_COPY.secureStorageActionLabel}
                    </button>
                    <div className="onboarding-overview-meta">
                      <div>
                        <span className="overview-current-set-cell-label">
                          {ONBOARDING_OVERVIEW_COPY.installedNowLabel}
                        </span>
                        <strong>
                          {installedNow.length ? (
                            <span className="tool-brand-list">
                              {installedNow.map((tool) => (
                                <ToolBrand
                                  key={tool}
                                  tool={tool}
                                  variant="inlineCompact"
                                />
                              ))}
                            </span>
                          ) : (
                            ONBOARDING_OVERVIEW_COPY.installedNowEmpty
                          )}
                        </strong>
                        <p className="inline-note">{ONBOARDING_OVERVIEW_COPY.installedNowNote}</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">
                          {ONBOARDING_OVERVIEW_COPY.switchReadyLabel}
                        </span>
                        <strong>{switchReadiness.label}</strong>
                        <p className="inline-note">{switchReadiness.detail}</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">
                          {ONBOARDING_OVERVIEW_COPY.runtimeLabel}
                        </span>
                        <strong>{runtimeReadinessLabel(bootstrap.runtime_status.compatible, "sentence")}</strong>
                        <p className="inline-note">
                          {onboardingRuntimeVersionDetail(bootstrap.runtime_status.version?.version)}
                        </p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">
                          {ONBOARDING_OVERVIEW_COPY.secureStorageLabel}
                        </span>
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
                  <PaneSectionHeader
                    kicker={ONBOARDING_RUNTIME_STEP_COPY.welcomeKicker}
                    title={ONBOARDING_RUNTIME_STEP_COPY.welcomeHeading}
                    actions={
                      <span className={`pill ${bootstrap.runtime_status.compatible ? "pill-ok" : "pill-soft"}`}>
                      {runtimeReadinessLabel(bootstrap.runtime_status.compatible, "sentence")}
                      </span>
                    }
                  />
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
                  <ButtonRow>
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
                  </ButtonRow>
                  {restoreBundledRuntimeMutation.error ? (
                    <p className="inline-note">
                      {restoreIncludedEngineErrorMessage(
                        restoreBundledRuntimeMutation.error,
                      )}
                    </p>
                  ) : null}
                </article>

                <article className="diagnostic-card">
                  <PaneSectionHeader
                    kicker={ONBOARDING_RUNTIME_STEP_COPY.nextKicker}
                    title={ONBOARDING_RUNTIME_STEP_COPY.nextHeading}
                  />
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
                  <PaneSectionHeader
                    kicker={ONBOARDING_ACCOUNTS_STEP_COPY.sectionKicker}
                    title={ONBOARDING_ACCOUNTS_STEP_COPY.sectionHeading}
                    actions={<p className="inline-note">{ONBOARDING_ACCOUNTS_STEP_COPY.sectionNote}</p>}
                  />
                  {accountItems.length ? (
                    <SplitView
                      className="onboarding-account-layout"
                      primaryClassName="onboarding-account-list-pane"
                      secondaryClassName="onboarding-account-detail-pane"
                      primary={
                        <article className="diagnostic-card onboarding-account-list-card">
                          <PaneSectionHeader
                            kicker={ONBOARDING_ACCOUNTS_STEP_COPY.listKicker}
                            title={ONBOARDING_ACCOUNTS_STEP_COPY.listHeading}
                            titleTag="h4"
                            actions={<span className="pill pill-soft">{countLabel(accountItems.length, "item")}</span>}
                          />
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
                                  aria-label={inspectItemLabel(title)}
                                  aria-pressed={selectedAccountItem?.key === item.key}
                                  onClick={() => setSelectedAccountKey(item.key)}
                                >
                                  <div className="onboarding-account-row-main">
                                    <strong>
                                      <ToolBrand
                                        tool={tool}
                                        variant="inline"
                                      />
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
                        selectedAccountItem && selectedAccountDetail ? (
                          <article
                            className={`diagnostic-card onboarding-account-detail-card ${
                              selectedAccountDetail.warning ? "diagnostic-warn" : ""
                            }`}
                          >
                            <OnboardingAccountDetailCard
                              state={selectedAccountDetail}
                              selectedAccountItem={selectedAccountItem}
                              mutationBusy={mutationLock.isBusy}
                              onOpenProfiles={onOpenProfiles}
                              onOpenLiveImport={openLiveImport}
                            />
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
                <PaneSectionHeader
                  kicker={ONBOARDING_SWITCH_STEP_COPY.kicker}
                  title={ONBOARDING_SWITCH_STEP_COPY.heading}
                  actions={<p className="inline-note">{ONBOARDING_SWITCH_STEP_COPY.note}</p>}
                />
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
                        label: selectedSwitchProfile?.label,
                      })
                    }
                  >
                    {onboardingSwitchSubmitLabel(useAllProfilesMutation.isPending)}
                  </button>
                </div>
                {!switchableProfiles.length ? (
                  <div className="stack-list">
                    <p className="inline-note">{ONBOARDING_SWITCH_STEP_COPY.emptyDetail}</p>
                    <ButtonRow>
                      <button className="ghost-button" type="button" onClick={() => onOpenProfiles("claude")}>
                        {ONBOARDING_SWITCH_STEP_COPY.openProfilesLabel}
                      </button>
                    </ButtonRow>
                  </div>
                ) : null}
              </article>
            ) : null}

            {activeStep === "terminal" ? (
              <article className="diagnostic-card">
                <PaneSectionHeader
                  kicker={ONBOARDING_TERMINAL_STEP_COPY.kicker}
                  title={ONBOARDING_TERMINAL_STEP_COPY.heading}
                  actions={<p className="inline-note">{ONBOARDING_TERMINAL_STEP_COPY.intro}</p>}
                />
                {shellGuidance.data?.detected_shell ? (
                  <p className="inline-note">
                    <strong>{onboardingDetectedShellSummary(shellGuidance.data.detected_shell)}</strong>
                  </p>
                ) : null}
                <p className="inline-note">{ONBOARDING_TERMINAL_STEP_COPY.primaryDetail}</p>
                <p className="inline-note">{ONBOARDING_TERMINAL_STEP_COPY.secondaryDetail}</p>
                <ButtonRow>
                  <button className="ghost-button" type="button" onClick={() => onOpenSettings("shell")}>
                    {ONBOARDING_TERMINAL_STEP_COPY.openSetupLabel}
                  </button>
                </ButtonRow>
              </article>
            ) : null}

            {activeStep === "done" ? (
              <article className="diagnostic-card onboarding-complete-card">
                <PaneSectionHeader
                  kicker={ONBOARDING_DONE_STEP_COPY.kicker}
                  title={ONBOARDING_DONE_STEP_COPY.heading}
                  actions={
                    <span className={`pill ${switchReady ? "pill-ok" : "pill-soft"}`}>
                      {onboardingDoneBadgeLabel(switchReady)}
                    </span>
                  }
                />
                <p className="inline-note">{ONBOARDING_DONE_STEP_COPY.note}</p>
                <div className="onboarding-complete-grid" aria-label={ONBOARDING_DONE_STEP_COPY.gridAriaLabel}>
                  {snapshot.statuses.map((status) => {
                    const profileCount = snapshot.profiles[status.tool]?.profiles.length ?? 0;
                    const completion = onboardingCompletionState(status, profileCount);
                    return (
                      <div key={status.tool} className="onboarding-complete-cell">
                        <span className="overview-current-set-cell-label">
                          <ToolBrand
                            tool={status.tool}
                            variant="inlineCompact"
                          />
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
              <ButtonRow className="onboarding-step-footer-actions">
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
                    {ONBOARDING_SETUP_SCREEN_COPY.closeLabel}
                  </button>
                ) : null}
              </ButtonRow>
            </article>
          </div>
        }
      />
      {pendingLiveImport ? (
        <DialogSurface
          ariaLabel={onboardingImportDialogAriaLabel(pendingLiveImport.tool)}
          className={DIALOG_SURFACE_CLASS_NAMES.sheet}
          initialFocusSelector={DIALOG_FOCUS_SELECTORS.inputThenAction}
          onClose={closeLiveImport}
        >
          <SheetHeader
            kicker={ONBOARDING_IMPORT_DIALOG_COPY.kicker}
            title={
              <>
                {ONBOARDING_IMPORT_DIALOG_COPY.headingPrefix}{" "}
                <ToolBrand
                  tool={pendingLiveImport.tool}
                  variant="inlineSection"
                  shortName
                />{" "}
                {ONBOARDING_IMPORT_DIALOG_COPY.headingSuffix}
              </>
            }
            detail={
              <>
                {ONBOARDING_IMPORT_DIALOG_COPY.introPrefix}
                {toolDisplayName(pendingLiveImport.tool)}
                {ONBOARDING_IMPORT_DIALOG_COPY.introSuffix}
              </>
            }
            actions={
              <button className="ghost-button" type="button" onClick={closeLiveImport}>
                {ONBOARDING_IMPORT_DIALOG_COPY.closeLabel}
              </button>
            }
          />
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
            <ButtonRow>
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
            </ButtonRow>
            {addProfileMutation.error ? (
              <p className="inline-note">{addProfileMutation.error.message}</p>
            ) : null}
          </form>
        </DialogSurface>
      ) : null}
    </div>
  );
}

function OnboardingAccountDetailCard({
  state,
  selectedAccountItem,
  mutationBusy,
  onOpenProfiles,
  onOpenLiveImport,
}: {
  state: OnboardingAccountDetailState;
  selectedAccountItem: OnboardingAccountItem;
  mutationBusy: boolean;
  onOpenProfiles: (tool: string, options?: { mode?: ProfileImportMode }) => void;
  onOpenLiveImport: (account: LiveAccount) => void;
}) {
  const action = state.action;

  function handleAction() {
    if (!action) {
      return;
    }

    switch (action.kind) {
      case "import_sheet":
        if (selectedAccountItem.kind === "live") {
          onOpenLiveImport(selectedAccountItem.account);
        }
        return;
      case "open_profiles":
        onOpenProfiles(action.tool, {
          mode: action.mode,
        });
        return;
      case "open_installation_guide":
        openExternalGuide(installGuideUrlForTool(action.tool));
        return;
    }
  }

  return (
    <>
      <PaneSectionHeader
        kicker={state.kicker}
        title={
          state.headingKind === "brand" ? (
            <ToolBrand
              tool={state.tool}
              variant="headingSection"
            />
          ) : (
            state.headingText
          )
        }
        actions={<span className={`pill pill-${state.badge.tone}`}>{state.badge.label}</span>}
      />
      {state.kind === "missing" ? (
        <p className="inline-note">
          <ToolBrand
            tool={state.tool}
            variant="inline"
          />
        </p>
      ) : null}
      <div className="onboarding-account-summary">
        {state.summaryRows.map((row) => (
          <div key={row.label}>
            <span className="overview-current-set-cell-label">{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      <p className="inline-note">
        {typeof state.note === "string" ? (
          state.note
        ) : (
          <>
            {state.note.before}
            <code>{state.note.code}</code>
            {state.note.after}
          </>
        )}
      </p>
      {action ? (
        <ButtonRow>
          <button
            className="ghost-button"
            type="button"
            aria-label={action.kind === "open_profiles" ? action.ariaLabel : undefined}
            disabled={mutationBusy}
            onClick={handleAction}
          >
            {action.label}
          </button>
        </ButtonRow>
      ) : null}
    </>
  );
}
