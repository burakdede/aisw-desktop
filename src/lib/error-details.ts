import { asObject, asOptionalString } from "./parse-guards";

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
      message: asOptionalString(record.message) ?? fallbackMessage,
      kind: asOptionalString(record.kind),
      remediation: asOptionalString(record.remediation),
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
