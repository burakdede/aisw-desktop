import { describe, expect, it } from "vitest";
import {
  AUTH_METHOD_NOT_CONFIGURED_LABEL,
  authMethodLabel,
} from "./auth-method-display";

describe("auth-method-display", () => {
  it("formats known auth methods and humanizes unknown values", () => {
    expect(authMethodLabel("oauth")).toBe("OAuth");
    expect(authMethodLabel("api_key")).toBe("API Key");
    expect(authMethodLabel("service_account")).toBe("Service Account");
  });

  it("uses the shared fallback or a caller override when auth is missing", () => {
    expect(authMethodLabel(null)).toBe(AUTH_METHOD_NOT_CONFIGURED_LABEL);
    expect(authMethodLabel(undefined, "Unavailable")).toBe("Unavailable");
  });
});
