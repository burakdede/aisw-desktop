export function normalizeTerminalIntegrationText(value: string) {
  return value
    .replace("Shell guidance remains informational.", "Terminal integration guidance remains informational.")
    .replace("Shell hook guidance remains informational.", "Terminal integration guidance remains informational.")
    .replace("Shell hook guidance", "Terminal integration guidance")
    .replace(
      "Shell hook is not active in the current shell session.",
      "Terminal integration is not active in the current shell session.",
    )
    .replace(
      "Install the shell hook and reload the shell.",
      "Install terminal integration and reload the shell.",
    );
}
