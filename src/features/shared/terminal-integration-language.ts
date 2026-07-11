export function normalizeTerminalIntegrationText(value: string) {
  return value
    .replace(
      "Shell hook is not active in the current shell session.",
      "Terminal integration is not active in the current shell session.",
    )
    .replace(
      "Install the shell hook and reload the shell.",
      "Install terminal integration and reload the shell.",
    );
}
