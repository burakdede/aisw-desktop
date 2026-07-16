export function formatMessageWithRemediation(
  message: string,
  remediation?: string | null,
) {
  return remediation ? `${message} Remediation: ${remediation}` : message;
}
