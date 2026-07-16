export type UnknownRecord = Record<string, unknown>;

export function asObject(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = "unknown") {
  return typeof value === "string" ? value : fallback;
}

export function asNonEmptyString(value: unknown, fallback = "unknown") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}
