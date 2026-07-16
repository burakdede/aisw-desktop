import type { AppBootstrap, AppSnapshot, InitReport, ToolStatus } from "../../lib/schemas";
import {
  checkStatusSymbol,
  normalizeResolvedCheckStatus,
  type ResolvedCheckStatus,
} from "../../lib/check-status";
import { isSystemKeyringBackend } from "../../lib/credential-backends";
import { toolDisplayName } from "../../lib/tool-display";
import { toolBinaryName } from "../../lib/tool-guidance";
import { runtimeSummary } from "../../lib/runtime-display";
import { titleCase } from "../../lib/utils";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import {
  normalizeOnboardingHealthDetail,
  normalizeOnboardingHealthLabel,
} from "./onboarding-health-display";

export type SetupStep = "accounts" | "runtime" | "switch" | "terminal" | "done";

export type LiveAccount = {
  tool: string;
  outcome?: string;
  auth_method?: string;
  matched_profile?: string | null;
};

export type OnboardingHealthItem = {
  label: string;
  status: ResolvedCheckStatus;
  detail: string;
};

export type OnboardingAccountItem =
  | { key: string; kind: "live"; account: LiveAccount }
  | { key: string; kind: "needs-profile"; status: ToolStatus }
  | { key: string; kind: "missing"; status: ToolStatus };

export type OnboardingAccountBadge = {
  label: string;
  tone: "ok" | "soft";
};

export type SetupStepOption = {
  value: SetupStep;
  label: string;
};

type SetupStepDetail = {
  summary: string;
  footerTitle: string;
  footerNote: string | ((switchReady: boolean) => string);
};

export type SecureStorageStatus = {
  available: boolean;
  label: string;
  detail: string;
};

export type OnboardingCompletionState = {
  state: string;
  detail: string;
};

type RuntimeToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export const ONBOARDING_SETUP_STEPS: readonly SetupStepOption[] = [
  { value: "runtime", label: "Welcome" },
  { value: "accounts", label: "Accounts" },
  { value: "switch", label: "First switch" },
  { value: "terminal", label: "Terminal" },
  { value: "done", label: "Done" },
];

export const ONBOARDING_TRUST_ROWS = [
  "Credentials stay on this computer",
  "No telemetry",
  "No prompt or API traffic proxy",
  "Built-in desktop engine ready",
] as const;

export const ONBOARDING_SETUP_SCREEN_COPY = {
  toolbarKicker: "Local-only setup",
  toolbarNote:
    "Set up AI Switch on this computer before you switch coding-agent profiles.",
  closeLabel: "Close setup",
} as const;

export const ONBOARDING_RUNTIME_STEP_COPY = {
  welcomeKicker: "Welcome",
  welcomeHeading: "Desktop engine",
  welcomePrimaryNote:
    "AI Switch already includes the desktop engine it needs. You do not need a separate command-line install to finish setup.",
  welcomeSecondaryNote:
    "If you already use a command-line switching tool, you can keep it installed. AI Switch Desktop stays on its included engine unless you deliberately override it.",
  settingsButtonLabel: "Engine Settings",
  nextKicker: "Next",
  nextHeading: "After setup",
  healthFallback:
    "Run the setup scan to populate desktop engine, storage, and tool health details.",
} as const;

export const ONBOARDING_RUNTIME_NEXT_STEPS = [
  {
    label: "1. Save your first profile",
    detail:
      "Import the login already open in a supported tool, or add a new profile from the Profiles section.",
  },
  {
    label: "2. Try one switch",
    detail:
      "Re-apply one saved set once so you know switching works before you start coding.",
  },
  {
    label: "3. Add terminal integration later if needed",
    detail:
      "Most people can skip terminal integration unless they need already-open shells to update immediately.",
  },
] as const;

export const ONBOARDING_ACCOUNTS_STEP_COPY = {
  sectionKicker: "Accounts",
  sectionHeading: "Detected tools",
  sectionNote:
    "Save current logins as reusable profiles, add missing profiles where needed, and ignore tools you do not use yet.",
  listKicker: "Detected tools",
  listHeading: "Choose one tool",
  listAriaLabel: "Detected tools",
  liveKicker: "Detected login",
  liveStatusLabel: "Status",
  liveSignInMethodLabel: "Sign-in method",
  liveMatchedProfileLabel: "Matched profile",
  unknownValue: "unknown",
  unmatchedProfileLabel: "Not matched yet",
  importActionLabel: "Import as profile",
  chooseSignInMethodLabel: "Choose sign-in method",
  needsProfileKicker: "Saved profile needed",
  needsProfileStatusLabel: "Status",
  needsProfileStatusValue: "Installed, but no saved profile yet",
  needsProfileCurrentStateLabel: "Current state",
  needsProfileCurrentStateValue: "No reusable account saved",
  addProfileActionLabel: "Add profile",
  missingKicker: "Optional tool",
  missingStatusLabel: "Status",
  missingStatusValue: "Optional for now",
  binaryLabel: "Binary",
  installationGuideLabel: "Open installation guide",
  emptyDetail: "Run the setup scan to detect live Claude, Codex, and Gemini accounts.",
} as const;

export const ONBOARDING_IMPORT_DIALOG_COPY = {
  kicker: "Import current account",
  closeLabel: "Close",
  headingPrefix: "Import",
  headingSuffix: "profile",
  introPrefix: "Save the account that ",
  introSuffix:
    " is already using as a reusable profile. This imported profile becomes the active saved account for this tool.",
  profileNameLabel: "Profile name",
  labelFieldLabel: "Label",
  cancelLabel: "Cancel",
} as const;

export const ONBOARDING_SWITCH_STEP_COPY = {
  kicker: "First switch",
  heading: "Try one safe switch",
  note:
    "Re-apply one saved set across installed tools so you know switching works before you start coding.",
  selectAriaLabel: "First switch profile",
  selectPlaceholder: "Select profile",
  emptyDetail:
    "Import or create matching profile names across tools before running a shared switch check.",
  openProfilesLabel: "Open Profiles",
} as const;

export const ONBOARDING_TERMINAL_STEP_COPY = {
  kicker: "Optional",
  heading: "Terminal integration",
  intro:
    "Optional. AI Switch updates live credential files without terminal integration. Turn this on later only if already-open terminal sessions need to pick up changes immediately.",
  detectedShellLabel: "Detected shell",
  primaryDetail:
    "This app writes live credential files directly. Most people can skip this and still switch accounts normally.",
  secondaryDetail:
    "Shell files should only be updated explicitly from guided setup, never silently.",
  openSetupLabel: "Open terminal setup",
} as const;

export const ONBOARDING_DONE_STEP_COPY = {
  kicker: "Done",
  heading: "You're ready",
  readyBadge: "Ready to switch",
  laterBadge: "Setup can continue later",
  note:
    "AI Switch is ready to manage saved local accounts on this computer. Missing tools stay optional, and you can add more profiles whenever you need them.",
  gridAriaLabel: "Setup completion status",
} as const;

export const ONBOARDING_STEP_FOOTER_COPY = {
  backLabel: "Back",
  continuePrefix: "Continue to ",
} as const;

const ONBOARDING_SWITCH_READY_FOOTER_NOTE =
  "Re-apply one saved set once so you know switching works before you start coding.";
const ONBOARDING_SWITCH_PENDING_FOOTER_NOTE =
  "You can continue, but you will need one saved set name before the first switch can succeed.";

const ONBOARDING_STEP_DETAILS: Record<SetupStep, SetupStepDetail> = {
  runtime: {
    summary: "Confirm the included desktop engine, data folder, and secure storage.",
    footerTitle: "Confirm the included desktop engine",
    footerNote:
      "Use the included desktop engine unless you intentionally want AI Switch to point at another managed engine.",
  },
  accounts: {
    summary: "Import current logins or add the first saved profiles you need.",
    footerTitle: "Save at least one reusable account",
    footerNote:
      "Imported current logins and saved profiles are what make safe switching possible later.",
  },
  switch: {
    summary: "Run one safe set switch before you start coding.",
    footerTitle: "Run a safe first switch",
    footerNote: (switchReady) =>
      switchReady ? ONBOARDING_SWITCH_READY_FOOTER_NOTE : ONBOARDING_SWITCH_PENDING_FOOTER_NOTE,
  },
  terminal: {
    summary: "Optional setup for already-open terminal sessions.",
    footerTitle: "Leave terminal integration for later unless you need it",
    footerNote:
      "The app already updates local credential files directly. Shell integration is only for already-open terminal sessions.",
  },
  done: {
    summary: "Review what is ready now and what can wait until later.",
    footerTitle: "Review the local setup summary",
    footerNote:
      "You can reopen setup later from Settings if you want to finish optional tools or terminal integration.",
  },
};

export type OnboardingInventory = {
  liveAccounts: LiveAccount[];
  installedToolsNeedingProfile: ToolStatus[];
  missingTools: ToolStatus[];
  accountItems: OnboardingAccountItem[];
  installedNow: string[];
  needsAttentionCount: number;
};

export function setupStepSummary(step: SetupStep) {
  return ONBOARDING_STEP_DETAILS[step].summary;
}

export function setupStepFooterTitle(step: SetupStep) {
  return ONBOARDING_STEP_DETAILS[step].footerTitle;
}

export function setupStepFooterNote(step: SetupStep, switchReady: boolean) {
  const footerNote = ONBOARDING_STEP_DETAILS[step].footerNote;
  return typeof footerNote === "function" ? footerNote(switchReady) : footerNote;
}

export function onboardingSwitchReadinessStatus(switchReady: boolean) {
  return switchReady
    ? {
        label: "Yes",
        detail: "At least one reusable profile is ready for a first switch.",
      }
    : {
        label: "Not yet",
        detail: "Save one profile first, then try the first shared switch.",
      };
}

export function readLiveAccounts(initReport: InitReport | undefined): LiveAccount[] {
  const result = initReport?.result as { live_accounts?: unknown } | undefined;
  const accounts = result?.live_accounts;
  return Array.isArray(accounts) ? (accounts as LiveAccount[]) : [];
}

export function buildOnboardingInventory(
  snapshot: AppSnapshot,
  initReport: InitReport | undefined,
): OnboardingInventory {
  const liveAccounts = readLiveAccounts(initReport);
  const liveAccountTools = new Set(liveAccounts.map((account) => account.tool));
  const installedToolsNeedingProfile = snapshot.statuses.filter(
    (status) =>
      status.binary_found &&
      !liveAccountTools.has(status.tool) &&
      (snapshot.profiles[status.tool]?.profiles.length ?? 0) === 0,
  );
  const missingTools = snapshot.statuses.filter((status) => !status.binary_found);
  const accountItems: OnboardingAccountItem[] = [
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
  ];

  return {
    liveAccounts,
    installedToolsNeedingProfile,
    missingTools,
    accountItems,
    installedNow: snapshot.statuses
      .filter((status) => status.binary_found)
      .map((status) => status.tool),
    needsAttentionCount:
      liveAccounts.length + installedToolsNeedingProfile.length + missingTools.length,
  };
}

export function shouldShowSetupFlow(
  snapshot: AppSnapshot,
  initReport: InitReport | undefined,
  forceOpen = false,
) {
  const totalProfiles = Object.values(snapshot.profiles).reduce(
    (sum, entry) => sum + entry.profiles.length,
    0,
  );
  const onboardingInventory = buildOnboardingInventory(snapshot, initReport);

  return (
    forceOpen ||
    totalProfiles === 0 ||
    onboardingInventory.liveAccounts.length > 0 ||
    onboardingInventory.installedToolsNeedingProfile.length > 0
  );
}

export function onboardingAccountBadge(item: OnboardingAccountItem): OnboardingAccountBadge {
  if (item.kind === "live") {
    return { tone: "ok", label: "Ready to import" };
  }
  if (item.kind === "needs-profile") {
    return { tone: "soft", label: "Needs profile" };
  }
  return { tone: "soft", label: "Not installed" };
}

export function onboardingAccountSummary(item: OnboardingAccountItem) {
  if (item.kind === "live") {
    return `${item.account.outcome ?? "unknown"} · ${item.account.auth_method ?? "unknown"}${
      item.account.matched_profile ? ` · matches ${item.account.matched_profile}` : ""
    }`;
  }
  if (item.kind === "needs-profile") {
    return "No saved profile yet";
  }
  return "Not installed yet";
}

export function selectDefaultAccountItem(items: OnboardingAccountItem[]) {
  return (
    items.find((item) => item.kind === "live") ??
    items.find((item) => item.kind === "missing") ??
    items.find((item) => item.kind === "needs-profile") ??
    null
  );
}

export function accountItemTool(item: OnboardingAccountItem) {
  return item.kind === "live" ? item.account.tool : item.status.tool;
}

export function defaultSetupStep(
  snapshot: AppSnapshot,
  initReport: InitReport | undefined,
): SetupStep {
  const onboardingInventory = buildOnboardingInventory(snapshot, initReport);

  if (
    onboardingInventory.liveAccounts.length ||
    onboardingInventory.installedToolsNeedingProfile.length ||
    onboardingInventory.missingTools.length
  ) {
    return "accounts";
  }

  return "runtime";
}

export function onboardingPrimaryActionLabel(
  initPending: boolean,
  initReport: InitReport | undefined,
) {
  if (initPending) {
    return "Checking This Computer…";
  }
  return initReport ? "Refresh Setup" : "Get Started";
}

export function onboardingImportedProfileLabel(name: string) {
  return `${titleCase(name)} account`;
}

export function onboardingImportSubmitLabel(isPending: boolean) {
  return isPending ? "Importing…" : "Import";
}

export function onboardingSwitchSubmitLabel(isPending: boolean) {
  return isPending ? "Switching…" : "Switch now";
}

export function restoreIncludedEngineActionLabel(isPending: boolean) {
  return isPending ? "Switching to Included Engine…" : "Use Included Engine";
}

export function restoreIncludedEngineErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Could not switch back to the included desktop engine.";
}

export function onboardingHealthStatusSymbol(status: OnboardingHealthItem["status"]) {
  return checkStatusSymbol(status);
}

export function onboardingDetectedShellSummary(shell: string | null | undefined) {
  if (!shell) {
    return null;
  }

  return `${ONBOARDING_TERMINAL_STEP_COPY.detectedShellLabel}: ${titleCase(shell)}`;
}

export function onboardingDoneBadgeLabel(switchReady: boolean) {
  return switchReady
    ? ONBOARDING_DONE_STEP_COPY.readyBadge
    : ONBOARDING_DONE_STEP_COPY.laterBadge;
}

export function onboardingStepProgressLabel(activeStepIndex: number, totalSteps: number) {
  return `Step ${activeStepIndex + 1} of ${totalSteps}`;
}

export function onboardingContinueLabel(stepLabel: string) {
  return `${ONBOARDING_STEP_FOOTER_COPY.continuePrefix}${stepLabel}`;
}

export function onboardingImportDialogAriaLabel(tool: string) {
  return `Import ${toolDisplayName(tool)} Profile`;
}

export function onboardingLiveAccountImportNote(tool: string, importSupported: boolean) {
  return importSupported
    ? `Save the current ${toolDisplayName(tool)} login as a reusable profile in a setup sheet.`
    : `This release cannot save the current ${toolDisplayName(tool)} login directly. Choose another sign-in method instead.`;
}

export function onboardingNeedsProfileNote(tool: string) {
  return `Add one reusable ${toolDisplayName(tool)} profile so this computer can switch that tool safely later.`;
}

export function onboardingMissingToolHeading(tool: string) {
  return `${toolDisplayName(tool)} is not installed`;
}

export function onboardingMissingToolNote(tool: string) {
  return `You can finish setup without ${toolDisplayName(tool)}. Install the ${toolBinaryName(tool)} tool later when you want to manage that provider here.`;
}

export function onboardingMissingToolNoteParts(tool: string) {
  const binary = toolBinaryName(tool);
  return {
    beforeBinary: `You can finish setup without ${toolDisplayName(tool)}. Install the `,
    binary,
    afterBinary: " tool later when you want to manage that provider here.",
  };
}

export function resolveOnboardingStepState(activeStep: SetupStep) {
  const activeStepIndex = ONBOARDING_SETUP_STEPS.findIndex(
    (step) => step.value === activeStep,
  );
  return {
    steps: ONBOARDING_SETUP_STEPS,
    activeStepIndex,
    previousStep: activeStepIndex > 0 ? ONBOARDING_SETUP_STEPS[activeStepIndex - 1] : null,
    nextStep:
      activeStepIndex >= 0 && activeStepIndex < ONBOARDING_SETUP_STEPS.length - 1
        ? ONBOARDING_SETUP_STEPS[activeStepIndex + 1]
        : null,
  };
}

export function resolveSelectedOnboardingAccountItem(
  items: OnboardingAccountItem[],
  selectedKey: string | null,
) {
  return (
    items.find((item) => item.key === selectedKey) ?? selectDefaultAccountItem(items) ?? null
  );
}

export function buildOnboardingHealthItems(
  bootstrap: AppBootstrap,
  snapshot: AppSnapshot,
  doctorReport: Record<string, unknown> | undefined,
): OnboardingHealthItem[] {
  const doctorChecks = Array.isArray(doctorReport?.checks) ? doctorReport.checks : [];
  const items: OnboardingHealthItem[] = [
    {
      label: "Desktop engine",
      status: bootstrap.runtime_status.compatible ? "pass" : "fail",
      detail: bootstrap.runtime_status.compatible
        ? bootstrap.settings.runtime_kind === "bundled"
          ? "Included desktop engine is compatible with this app."
          : "Selected engine override is compatible with this app."
        : normalizeRuntimeLanguage(bootstrap.runtime_status.issues.join(" · ")) ||
          "Compatibility checks failed.",
    },
  ];

  doctorChecks.forEach((entry) => {
    const check = entry as { name?: string; status?: string; detail?: string };
    items.push({
      label: normalizeOnboardingHealthLabel(check.name),
      status: normalizeResolvedCheckStatus(check.status, "warn"),
      detail: normalizeOnboardingHealthDetail(check.detail),
    });
  });

  snapshot.statuses.forEach((status) => {
    items.push({
      label: `${toolDisplayName(status.tool)} availability`,
      status: status.binary_found ? "pass" : "fail",
      detail: status.binary_found
        ? `${toolDisplayName(status.tool)} detected${
            status.active_profile ? ` · active ${status.active_profile}` : ""
          }.`
        : `${toolDisplayName(status.tool)} binary was not detected on PATH or in live state.`,
    });
  });

  return items;
}

export function buildOnboardingRuntimeRows(
  bootstrap: AppBootstrap,
  snapshot: AppSnapshot,
  toolCapabilities: RuntimeToolCapabilities,
): OnboardingHealthItem[] {
  const secureStorage = onboardingSecureStorageStatus(snapshot, toolCapabilities);

  return [
    {
      label: "Desktop engine",
      status: bootstrap.runtime_status.compatible ? "pass" : "warn",
      detail:
        bootstrap.settings.runtime_kind === "bundled"
          ? `Ready. Version ${bootstrap.runtime_status.version?.version ?? "unknown"}.`
          : `Available, but AI Switch is currently using ${runtimeSummary(
              bootstrap.settings.runtime_kind,
            ).source.toLowerCase()}.`,
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
      status: secureStorage.available ? "pass" : "warn",
      detail: secureStorage.detail,
    },
  ];
}

export function onboardingCompletionState(
  status: ToolStatus,
  profileCount: number,
): OnboardingCompletionState {
  if (!status.binary_found) {
    return {
      state: "Not installed",
      detail: "Optional for now.",
    };
  }

  if (status.active_profile) {
    return {
      state: status.active_profile,
      detail: "Active on this computer.",
    };
  }

  if (profileCount > 0) {
    return {
      state: `${profileCount} saved profile${profileCount === 1 ? "" : "s"}`,
      detail: "Saved locally and ready when needed.",
    };
  }

  return {
    state: "Not configured",
    detail: `Add a ${toolDisplayName(status.tool)} profile later from Profiles.`,
  };
}

export function onboardingSecureStorageStatus(
  snapshot: AppSnapshot,
  toolCapabilities: RuntimeToolCapabilities,
  platform = typeof navigator === "undefined" ? "" : navigator.platform.toLowerCase(),
): SecureStorageStatus {
  if (!supportsSecureStorage(snapshot, toolCapabilities)) {
    return {
      available: false,
      label: "Not confirmed",
      detail:
        "Secure storage has not been confirmed yet. You can still continue with local file-based profiles.",
    };
  }

  if (platform.includes("mac")) {
    return {
      available: true,
      label: "Available",
      detail: "Login Keychain available for local credential storage.",
    };
  }
  if (platform.includes("win")) {
    return {
      available: true,
      label: "Available",
      detail: "Windows Credential Manager available for local credential storage.",
    };
  }
  return {
    available: true,
    label: "Available",
    detail: "System keyring available for local credential storage.",
  };
}

export function supportsSecureStorage(
  snapshot: AppSnapshot,
  toolCapabilities: RuntimeToolCapabilities,
) {
  return (
    snapshot.statuses.some((status) => isSystemKeyringBackend(status.credential_backend)) ||
    Object.values(toolCapabilities).some((capability) =>
      capability.credential_backends.some((backend) => isSystemKeyringBackend(backend)),
    )
  );
}
