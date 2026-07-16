import { describe, expect, it } from "vitest";
import {
  DESKTOP_COMMANDS,
  REFERENCE_DOCUMENT_KIND_DOCUMENTATION,
  REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING,
  REFERENCE_DOCUMENT_KINDS,
} from "./desktop-command-contract";

describe("desktop-command-contract", () => {
  it("shares desktop command ids", () => {
    expect(DESKTOP_COMMANDS.getBootstrap).toBe("get_bootstrap");
    expect(DESKTOP_COMMANDS.addProfile).toBe("add_profile");
    expect(DESKTOP_COMMANDS.runVerify).toBe("run_verify");
    expect(DESKTOP_COMMANDS.openReferenceDocument).toBe("open_reference_document");
    expect(DESKTOP_COMMANDS.workspaceGuard).toBe("workspace_guard");
    expect(DESKTOP_COMMANDS.updateSettings).toBe("update_settings");
  });

  it("shares reference document kinds", () => {
    expect(REFERENCE_DOCUMENT_KINDS).toEqual(["documentation", "troubleshooting"]);
    expect(REFERENCE_DOCUMENT_KIND_DOCUMENTATION).toBe("documentation");
    expect(REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING).toBe("troubleshooting");
  });
});
