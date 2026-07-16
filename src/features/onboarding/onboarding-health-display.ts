import { titleCase } from "../../lib/utils";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

export const ONBOARDING_HEALTH_SETUP_CHECK_LABEL = "Setup check";
export const ONBOARDING_HEALTH_NO_DETAIL_LABEL = "No detail provided.";

const ONBOARDING_HEALTH_LABEL_RULES = [
  { label: "Terminal integration", keywords: ["shell"] },
  { label: "Secure storage", keywords: ["keyring"] },
  { label: "Local permissions", keywords: ["permission"] },
  { label: "Sign-in flow", keywords: ["oauth"] },
  { label: "Backups", keywords: ["backup"] },
  { label: "Desktop engine", keywords: ["runtime", "engine"] },
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
