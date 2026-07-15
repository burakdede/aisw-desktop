export {
  installCommandForTool,
  installGuideUrlForTool,
  toolBinaryName,
} from "./tool-registry";

export function commandForCurrentPlatform(binary: string, kind: "verify" | "path") {
  const platform = typeof navigator === "undefined" ? "" : `${navigator.userAgent} ${navigator.platform}`;
  const isWindows = /Windows/i.test(platform);
  if (kind === "verify") {
    return `${binary} --version`;
  }
  return isWindows ? `where ${binary}` : `which ${binary}`;
}

export function openExternalGuide(url: string) {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
