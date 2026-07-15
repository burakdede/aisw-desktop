import { describe, expect, it } from "vitest";
import {
  AVAILABLE_AFTER_ACTIVATION_LABEL,
  HIDE_STORAGE_DETAILS_LABEL,
  NOT_VERIFIED_LABEL,
  STORAGE_DETAILS_LABEL,
  profileAddedLabel,
  profileAuthMethodLabel,
  profileLastCheckedLabel,
  profileStateModeLabel,
  profileStorageBooleanLabel,
  profileStorageDetailsToggleLabel,
  profileTokenWarningLabel,
  profileWarningLabel,
} from "./profile-detail-display";

describe("profile-detail-display", () => {
  it("formats auth methods", () => {
    expect(profileAuthMethodLabel("oauth")).toBe("OAuth");
    expect(profileAuthMethodLabel("api_key")).toBe("API Key");
    expect(profileAuthMethodLabel("service_account")).toBe("Service Account");
  });

  it("formats state modes", () => {
    expect(profileStateModeLabel(null)).toBe("Not Available");
    expect(profileStateModeLabel("isolated")).toBe("Isolated");
  });

  it("formats storage booleans", () => {
    expect(profileStorageBooleanLabel(undefined)).toBe("Verification Required");
    expect(profileStorageBooleanLabel(true)).toBe("Yes");
    expect(profileStorageBooleanLabel(false)).toBe("No");
  });

  it("formats token warnings", () => {
    expect(profileTokenWarningLabel({ token_warning: null })).toBe("Token state needs attention.");
    expect(
      profileTokenWarningLabel({
        token_warning: { summary: "Token expires soon", expires_in_days: 2 },
      }),
    ).toBe("Token expires soon Expires in 2 days.");
  });

  it("formats profile warnings", () => {
    expect(profileWarningLabel({ message: "Permission mismatch", remediation: "Re-run login" })).toBe(
      "Permission mismatch Remediation: Re-run login",
    );
    expect(profileWarningLabel({ code: "warn_code" })).toBe("warn_code");
  });

  it("formats date fallbacks", () => {
    expect(profileLastCheckedLabel("Jul 10", true)).toBe("Jul 10");
    expect(profileLastCheckedLabel(null, true)).toBe(NOT_VERIFIED_LABEL);
    expect(profileLastCheckedLabel(null, false)).toBe("Date Unavailable");
    expect(profileAddedLabel("Jul 11")).toBe("Jul 11");
    expect(profileAddedLabel(null)).toBe("Date Unavailable");
  });

  it("formats storage detail toggle labels", () => {
    expect(profileStorageDetailsToggleLabel(false)).toBe(STORAGE_DETAILS_LABEL);
    expect(profileStorageDetailsToggleLabel(true)).toBe(HIDE_STORAGE_DETAILS_LABEL);
  });

  it("exports shared inactive live labels", () => {
    expect(AVAILABLE_AFTER_ACTIVATION_LABEL).toBe("Available after activation");
  });
});
