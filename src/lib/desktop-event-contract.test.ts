import { describe, expect, it } from "vitest";
import {
  DESKTOP_DIAGNOSTIC_QUERY_KEYS,
  DESKTOP_EVENTS,
  DESKTOP_MENU_EVENTS,
  DESKTOP_TRAY_EVENTS,
} from "./desktop-event-contract";

describe("desktop-event-contract", () => {
  it("shares desktop menu and tray event names", () => {
    expect(DESKTOP_MENU_EVENTS.openSettings).toBe("menu-open-settings");
    expect(DESKTOP_MENU_EVENTS.openQuickSwitch).toBe("menu-open-quick-switch");
    expect(DESKTOP_MENU_EVENTS.reapplyActiveProfile).toBe("menu-reapply-active-profile");
    expect(DESKTOP_TRAY_EVENTS.openDiagnostics).toBe("tray-open-diagnostics");
    expect(DESKTOP_TRAY_EVENTS.runDiagnostics).toBe("tray-run-diagnostics");
    expect(DESKTOP_TRAY_EVENTS.commandResult).toBe("tray-command-result");
    expect(DESKTOP_EVENTS.openIssues).toBe("menu-open-issues");
    expect(DESKTOP_EVENTS.commandResult).toBe("tray-command-result");
  });

  it("shares diagnostics query keys", () => {
    expect(DESKTOP_DIAGNOSTIC_QUERY_KEYS).toEqual([
      ["doctor"],
      ["verify"],
      ["repair", "dry-run"],
      ["snapshot"],
      ["bootstrap"],
    ]);
  });
});
