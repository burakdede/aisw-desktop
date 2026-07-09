import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

type DesktopNotification = {
  title: string;
  body: string;
};

declare global {
  interface Window {
    __AISW_DESKTOP_NOTIFY__?: (payload: DesktopNotification) => void | Promise<void>;
  }
}

export async function notifyDesktop(payload: DesktopNotification) {
  if (typeof window !== "undefined" && window.__AISW_DESKTOP_NOTIFY__) {
    await window.__AISW_DESKTOP_NOTIFY__(payload);
    return;
  }

  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }

    if (!permissionGranted) {
      return;
    }

    await sendNotification(payload);
  } catch {
    // Ignore notification failures in non-Tauri test/browser environments.
  }
}
