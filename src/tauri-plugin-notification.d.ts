declare module "@tauri-apps/plugin-notification" {
  export function isPermissionGranted(): Promise<boolean>;
  export function requestPermission(): Promise<"default" | "denied" | "granted">;
  export function sendNotification(payload: { title: string; body: string }): Promise<void>;
}
