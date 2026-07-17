import {
  asObject,
  asOptionalString,
  asOptionalStringField,
  asOptionalStringFieldOr,
} from "./parse-guards";
import { formatMessageWithRemediation } from "./remediation-text";

export type ErrorMetadata = {
  remediation?: string;
  kind?: string;
};

export type ErrorDetails = {
  message: string;
} & ErrorMetadata;

export function resolveErrorDetails(
  error: unknown,
  fallbackMessage: string,
): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      kind: asOptionalString((error as { kind?: unknown }).kind),
      remediation: asOptionalString(
        (error as { remediation?: unknown }).remediation,
      ),
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  const record = asObject(error);
  if (record) {
    return {
      message: asOptionalStringFieldOr(record, "message", fallbackMessage),
      kind: asOptionalStringField(record, "kind"),
      remediation: asOptionalStringField(record, "remediation"),
    };
  }

  return { message: fallbackMessage };
}

export function resolveErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return resolveErrorDetails(error, fallbackMessage).message;
}

export function resolveNormalizedErrorDetails(
  error: unknown,
  fallbackMessage: string,
  normalizeText: (text: string) => string,
): ErrorDetails {
  const details = resolveErrorDetails(error, fallbackMessage);
  return {
    ...details,
    message: normalizeText(details.message),
    remediation: details.remediation ? normalizeText(details.remediation) : undefined,
  };
}

export function formatResolvedErrorMessage(
  error: unknown,
  fallbackMessage: string,
  options?: {
    normalizeText?: (text: string) => string;
    remediationPrefix?: string;
  },
) {
  const details = options?.normalizeText
    ? resolveNormalizedErrorDetails(error, fallbackMessage, options.normalizeText)
    : resolveErrorDetails(error, fallbackMessage);

  return formatMessageWithRemediation(details.message, details.remediation, {
    prefix: options?.remediationPrefix,
  });
}
