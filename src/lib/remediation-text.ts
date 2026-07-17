export function formatMessageWithRemediation(
  message: string,
  remediation?: string | null,
  options?: { prefix?: string },
) {
  if (!remediation) {
    return message;
  }

  return `${message} ${options?.prefix ?? "Remediation: "}${remediation}`;
}
