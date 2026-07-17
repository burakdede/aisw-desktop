import { describe, expect, it } from "vitest";
import {
  CORE_DESKTOP_QUERY_KEYS,
  DESKTOP_DIAGNOSTIC_QUERY_KEYS,
  DESKTOP_QUERY_KEYS,
  POST_MUTATION_QUERY_KEYS,
  SNAPSHOT_DESKTOP_QUERY_KEYS,
} from "./desktop-query-keys";

describe("desktop-query-keys", () => {
  it("shares stable query key definitions", () => {
    expect(DESKTOP_QUERY_KEYS).toEqual({
      bootstrap: ["bootstrap"],
      snapshot: ["snapshot"],
      init: ["init"],
      doctor: ["doctor"],
      verify: ["verify"],
      repairDryRun: ["repair", "dry-run"],
      backups: ["backups"],
      workspaceStatus: ["workspace-status"],
      projectBindings: ["project-bindings"],
      shellGuidance: ["shell-guidance"],
      launchAtLogin: ["launch-at-login"],
    });
    expect(CORE_DESKTOP_QUERY_KEYS).toEqual([
      ["bootstrap"],
      ["snapshot"],
      ["init"],
    ]);
    expect(SNAPSHOT_DESKTOP_QUERY_KEYS).toEqual([
      ["bootstrap"],
      ["snapshot"],
    ]);
    expect(DESKTOP_DIAGNOSTIC_QUERY_KEYS).toEqual([
      ["doctor"],
      ["verify"],
      ["repair", "dry-run"],
      ["snapshot"],
      ["bootstrap"],
    ]);
    expect(POST_MUTATION_QUERY_KEYS).toEqual([
      ["bootstrap"],
      ["snapshot"],
      ["doctor"],
      ["verify"],
      ["backups"],
      ["init"],
      ["workspace-status"],
      ["project-bindings"],
    ]);
  });
});
