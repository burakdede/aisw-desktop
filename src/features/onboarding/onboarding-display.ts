import type { AppBootstrap, AppSnapshot, InitReport, ToolStatus } from "../../lib/schemas";
import { runtimeSummary } from "../../lib/runtime-display";
import { toolDisplayName } from "../../lib/tool-display";
import { titleCase } from "../../lib/utils";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

export type SetupStep = "accounts" | "runtime" | "switch" | "terminal" | "done";

export type LiveAccount = {
  tool: string;
  outcome?: string;
  auth_method?: string;
  matched_profile?: string | null;
};

export type OnboardingHealthItem = {
  label: string;
  status: "pass" | "warn" | "fail";
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

export type SecureStorageStatus = {
  available: boolean;
  label: string;
  detail: string;
};

type RuntimeToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

export function setupStepSummary(step: SetupStep) {
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

export function setupStepFooterTitle(step: SetupStep) {
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

export function setupStepFooterNote(step: SetupStep, switchReady: boolean) {
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
  const installedToolsNeedingProfile = snapshot.statuses.filter(
    (status) =>
      status.binary_found &&
      !liveAccountTools.has(status.tool) &&
      (snapshot.profiles[status.tool]?.profiles.length ?? 0) === 0,
  );

  return (
    forceOpen ||
    totalProfiles === 0 ||
    liveAccounts.length > 0 ||
    installedToolsNeedingProfile.length > 0
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
    const status =
      check.status === "pass" || check.status === "warn" || check.status === "fail"
        ? check.status
        : "warn";
    items.push({
      label: normalizeOnboardingHealthLabel(check.name),
      status,
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
    snapshot.statuses.some(
      (status) =>
        status.credential_backend === "system_keyring" ||
        status.credential_backend === "system-keyring",
    ) ||
    Object.values(toolCapabilities).some((capability) =>
      capability.credential_backends.includes("system-keyring"),
    )
  );
}

function normalizeOnboardingHealthLabel(value: string | undefined) {
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

function normalizeOnboardingHealthDetail(value: string | undefined) {
  return normalizeTerminalIntegrationText(
    normalizeRuntimeLanguage(value ?? "No detail provided."),
  );
}
