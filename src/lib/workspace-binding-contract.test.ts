import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_BINDING_SCOPE,
  normalizeWorkspaceBindingScope,
  WORKSPACE_BINDING_SCOPES,
} from "./workspace-binding-contract";

describe("workspace-binding-contract", () => {
  it("shares supported workspace binding scopes", () => {
    expect(WORKSPACE_BINDING_SCOPES).toEqual(["default", "path", "git_remote"]);
    expect(DEFAULT_WORKSPACE_BINDING_SCOPE).toBe("default");
  });

  it("normalizes workspace binding scopes", () => {
    expect(normalizeWorkspaceBindingScope("default")).toBe("default");
    expect(normalizeWorkspaceBindingScope("path")).toBe("path");
    expect(normalizeWorkspaceBindingScope("git_remote")).toBe("git_remote");
    expect(normalizeWorkspaceBindingScope("bad")).toBe("default");
    expect(normalizeWorkspaceBindingScope("bad", "path")).toBe("path");
  });
});
