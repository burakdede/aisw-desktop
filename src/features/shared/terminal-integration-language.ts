export function normalizeTerminalIntegrationText(value: string) {
  return value
    .replace("workspace guardrails", "project-rule guardrails")
    .replace("Workspace guardrails", "Project-rule guardrails")
    .replace("workspace checks", "project-rule checks")
    .replace("Workspace checks", "Project-rule checks")
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
    )
    .replace("shell hook", "terminal integration")
    .replace("Shell hook", "Terminal integration");
}
