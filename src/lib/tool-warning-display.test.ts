import { describe, expect, it } from "vitest";
import {
  APP_WARNING_FALLBACK_DETAIL,
  formatTokenWarning,
  formatToolWarning,
  RUNTIME_WARNING_FALLBACK_DETAIL,
  TOKEN_WARNING_FALLBACK_DETAIL,
} from "./tool-warning-display";

describe("tool-warning-display", () => {
  it("formats token warnings with shared fallback, expiry details, and optional prefixes", () => {
    expect(formatTokenWarning(null)).toBe(TOKEN_WARNING_FALLBACK_DETAIL);
    expect(
      formatTokenWarning(
        { summary: "Token expires soon", expires_in_days: 2 },
        { prefix: "Token warning: " },
      ),
    ).toBe("Token warning: Token expires soon Expires in 2 days.");
    expect(
      formatTokenWarning({ message: "Session expired", expires_at: "2026-07-16T12:00:00Z" }),
    ).toBe("Session expired Expires at 2026-07-16T12:00:00Z.");
  });

  it("formats generic tool warnings with remediation, prefix, and caller fallback detail", () => {
    expect(
      formatToolWarning({ message: "Workspace mismatch", remediation: "Open Sets" }),
    ).toBe("Workspace mismatch Remediation: Open Sets");
    expect(formatToolWarning({ code: "warn_code" })).toBe("warn_code");
    expect(
      formatToolWarning({}, { prefix: "Warning: ", fallbackDetail: RUNTIME_WARNING_FALLBACK_DETAIL }),
    ).toBe(`Warning: ${RUNTIME_WARNING_FALLBACK_DETAIL}`);
    expect(formatToolWarning({}, { fallbackDetail: APP_WARNING_FALLBACK_DETAIL })).toBe(
      APP_WARNING_FALLBACK_DETAIL,
    );
  });
});
