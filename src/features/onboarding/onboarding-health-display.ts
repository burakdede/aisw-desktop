import { APP_NAV_IDS, APP_NAV_LABELS } from "../../lib/app-navigation";
import {
  DESKTOP_ENGINE_LABEL,
  LOCAL_PERMISSIONS_LABEL,
  NO_DETAIL_PROVIDED_LABEL,
  SECURE_STORAGE_LABEL,
  SETUP_CHECK_LABEL,
  SIGN_IN_FLOW_LABEL,
  TERMINAL_INTEGRATION_LABEL,
} from "../../lib/desktop-domain-copy";
import { titleCase } from "../../lib/utils";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

export const ONBOARDING_HEALTH_SETUP_CHECK_LABEL = SETUP_CHECK_LABEL;
export const ONBOARDING_HEALTH_NO_DETAIL_LABEL = NO_DETAIL_PROVIDED_LABEL;

const ONBOARDING_HEALTH_LABEL_RULES = [
  { label: TERMINAL_INTEGRATION_LABEL, keywords: ["shell"] },
  { label: SECURE_STORAGE_LABEL, keywords: ["keyring"] },
  { label: LOCAL_PERMISSIONS_LABEL, keywords: ["permission"] },
  { label: SIGN_IN_FLOW_LABEL, keywords: ["oauth"] },
  { label: APP_NAV_LABELS[APP_NAV_IDS.backups], keywords: ["backup"] },
  { label: DESKTOP_ENGINE_LABEL, keywords: ["runtime", "engine"] },
] as const;

export function normalizeOnboardingHealthLabel(value: string | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!normalized) {
    return ONBOARDING_HEALTH_SETUP_CHECK_LABEL;
  }

  const matchedRule = ONBOARDING_HEALTH_LABEL_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword)),
  );
  if (matchedRule) {
    return matchedRule.label;
  }

  return titleCase(normalized);
}

export function normalizeOnboardingHealthDetail(value: string | undefined) {
  return normalizeTerminalIntegrationText(
    normalizeRuntimeLanguage(value ?? ONBOARDING_HEALTH_NO_DETAIL_LABEL),
  );
}
