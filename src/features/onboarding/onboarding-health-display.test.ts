import { describe, expect, it } from "vitest";
import {
  normalizeOnboardingHealthDetail,
  normalizeOnboardingHealthLabel,
  ONBOARDING_HEALTH_NO_DETAIL_LABEL,
  ONBOARDING_HEALTH_SETUP_CHECK_LABEL,
} from "./onboarding-health-display";

describe("onboarding-health-display", () => {
  it("maps known onboarding health keywords to shared labels", () => {
    expect(normalizeOnboardingHealthLabel(undefined)).toBe(ONBOARDING_HEALTH_SETUP_CHECK_LABEL);
    expect(normalizeOnboardingHealthLabel("shell_hook")).toBe("Terminal integration");
    expect(normalizeOnboardingHealthLabel("keyring_access")).toBe("Secure storage");
    expect(normalizeOnboardingHealthLabel("permission check")).toBe("Local permissions");
    expect(normalizeOnboardingHealthLabel("oauth_permission")).toBe("Local permissions");
    expect(normalizeOnboardingHealthLabel("oauth_flow")).toBe("Sign-in flow");
    expect(normalizeOnboardingHealthLabel("backup status")).toBe("Backups");
    expect(normalizeOnboardingHealthLabel("runtime_override")).toBe("Desktop engine");
    expect(normalizeOnboardingHealthLabel("provider account")).toBe("Provider Account");
  });

  it("normalizes onboarding health detail text with the shared terminal language", () => {
    expect(normalizeOnboardingHealthDetail(undefined)).toBe(ONBOARDING_HEALTH_NO_DETAIL_LABEL);
    expect(
      normalizeOnboardingHealthDetail("Shell hook is not active in the current shell session."),
    ).toBe("Terminal integration is not active in the current shell session.");
  });
});
