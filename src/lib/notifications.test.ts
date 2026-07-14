import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyDesktop } from "./notifications";

const notificationMocks = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => notificationMocks);

describe("desktop notifications", () => {
  beforeEach(() => {
    delete window.__AISW_DESKTOP_NOTIFY__;
    notificationMocks.isPermissionGranted.mockReset();
    notificationMocks.requestPermission.mockReset();
    notificationMocks.sendNotification.mockReset();
  });

  it("uses the injected desktop notifier when present", async () => {
    window.__AISW_DESKTOP_NOTIFY__ = vi.fn();

    await notifyDesktop({ title: "Done", body: "Saved profile." });

    expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
      title: "Done",
      body: "Saved profile.",
    });
    expect(notificationMocks.sendNotification).not.toHaveBeenCalled();
  });

  it("sends a native notification when permission is already granted", async () => {
    notificationMocks.isPermissionGranted.mockResolvedValue(true);

    await notifyDesktop({ title: "Ready", body: "Switch complete." });

    expect(notificationMocks.requestPermission).not.toHaveBeenCalled();
    expect(notificationMocks.sendNotification).toHaveBeenCalledWith({
      title: "Ready",
      body: "Switch complete.",
    });
  });

  it("requests permission before sending when needed", async () => {
    notificationMocks.isPermissionGranted.mockResolvedValue(false);
    notificationMocks.requestPermission.mockResolvedValue("granted");

    await notifyDesktop({ title: "Ready", body: "Switch complete." });

    expect(notificationMocks.requestPermission).toHaveBeenCalled();
    expect(notificationMocks.sendNotification).toHaveBeenCalledWith({
      title: "Ready",
      body: "Switch complete.",
    });
  });

  it("silently skips notifications when permission stays denied or the plugin fails", async () => {
    notificationMocks.isPermissionGranted.mockResolvedValue(false);
    notificationMocks.requestPermission.mockResolvedValue("denied");

    await notifyDesktop({ title: "Denied", body: "No-op." });

    expect(notificationMocks.sendNotification).not.toHaveBeenCalled();

    notificationMocks.isPermissionGranted.mockRejectedValue(new Error("plugin unavailable"));

    await expect(
      notifyDesktop({ title: "Unavailable", body: "No-op." }),
    ).resolves.toBeUndefined();
  });
});
