import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_GUARD_MODE,
  normalizeWorkspaceGuardMode,
  WORKSPACE_GUARD_MODES,
  WORKSPACE_NO_CONTEXT,
} from "./workspace-policy";

describe("workspace-policy", () => {
  it("shares workspace guard modes and defaults", () => {
    expect(WORKSPACE_GUARD_MODES).toEqual(["warn", "strict"]);
    expect(DEFAULT_WORKSPACE_GUARD_MODE).toBe("warn");
    expect(WORKSPACE_NO_CONTEXT).toBe("none");
  });

  it("normalizes workspace guard modes", () => {
    expect(normalizeWorkspaceGuardMode("warn")).toBe("warn");
    expect(normalizeWorkspaceGuardMode("strict")).toBe("strict");
    expect(normalizeWorkspaceGuardMode("bad")).toBe("warn");
    expect(normalizeWorkspaceGuardMode("bad", "strict")).toBe("strict");
  });
});
