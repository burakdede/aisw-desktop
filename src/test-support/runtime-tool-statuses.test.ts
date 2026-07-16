import { describe, expect, it } from "vitest";
import { makeToolStatus } from "./runtime-tool-statuses";

describe("runtime-tool-statuses", () => {
  it("builds a tool status with shared defaults", () => {
    expect(makeToolStatus("claude")).toEqual({
      tool: "claude",
      binary_found: true,
      stored_profiles: 0,
      active_profile: null,
      auth_method: null,
      credential_backend: null,
      state_mode: null,
      active_profile_applied: null,
      credentials_present: null,
      permissions_ok: null,
      token_warning: null,
      warnings: [],
    });
  });

  it("lets tests override only the fields they need", () => {
    expect(
      makeToolStatus("codex", {
        stored_profiles: 2,
        active_profile: "work",
        auth_method: "oauth",
      }),
    ).toMatchObject({
      tool: "codex",
      stored_profiles: 2,
      active_profile: "work",
      auth_method: "oauth",
      warnings: [],
    });
  });
});
