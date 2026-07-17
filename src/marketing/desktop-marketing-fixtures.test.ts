import { describe, expect, it } from "vitest";
import type { AppSnapshot, DesktopSettings } from "../lib/schemas";
import { createMarketingDesktopMock } from "./desktop-marketing-fixtures";

describe("desktop-marketing-fixtures", () => {
  it("activates a saved profile set from a top-level name argument", async () => {
    const mock = createMarketingDesktopMock("overview");

    await mock("activate_profile_set", { name: "release-review" });
    const snapshot = await mock("get_snapshot") as AppSnapshot;

    expect(snapshot.profiles.claude?.active).toBe("review");
    expect(snapshot.profiles.codex?.active).toBe("release");
    expect(snapshot.profiles.gemini?.active).toBe("research");
  });

  it("applies one shared profile name across matching tools from request args", async () => {
    const mock = createMarketingDesktopMock("overview");

    await mock("use_all_profiles", { request: { profile: "personal" } });
    const snapshot = await mock("get_snapshot") as AppSnapshot;

    expect(snapshot.profiles.claude?.active).toBe("personal");
    expect(snapshot.profiles.codex?.active).toBe("personal");
    expect(snapshot.profiles.gemini?.active).toBe("personal");
  });

  it("uses a context request to apply the matching set", async () => {
    const mock = createMarketingDesktopMock("overview");

    await mock("use_context", { request: { context: "personal-stack" } });
    const snapshot = await mock("get_snapshot") as AppSnapshot;

    expect(snapshot.profiles.claude?.active).toBe("personal");
    expect(snapshot.profiles.codex?.active).toBe("personal");
    expect(snapshot.profiles.gemini?.active).toBe("personal");
  });

  it("updates settings from a nested request object", async () => {
    const mock = createMarketingDesktopMock("overview");

    const settings = await mock("update_settings", {
      request: { runtime_kind: "custom", runtime_path: "/tmp/aisw-marketing" },
    }) as DesktopSettings;

    expect(settings.runtime_kind).toBe("custom");
    expect(settings.runtime_path).toBe("/tmp/aisw-marketing");
  });

  it("ignores malformed profile requests without mutating the snapshot", async () => {
    const mock = createMarketingDesktopMock("overview");

    await mock("use_profile", { request: { tool: "claude", profile: 42 } });
    const snapshot = await mock("get_snapshot") as AppSnapshot;

    expect(snapshot.profiles.claude?.active).toBe("acme");
    expect(snapshot.profiles.codex?.active).toBe("acme");
    expect(snapshot.profiles.gemini?.active).toBe("acme");
  });
});
