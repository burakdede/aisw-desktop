import { titleCase } from "./utils";

export const AUTH_METHOD_NOT_CONFIGURED_LABEL = "Not configured";

export function authMethodLabel(
  authMethod: string | null | undefined,
  fallback = AUTH_METHOD_NOT_CONFIGURED_LABEL,
) {
  if (!authMethod) {
    return fallback;
  }
  if (authMethod === "oauth") {
    return "OAuth";
  }
  if (authMethod === "api_key") {
    return "API Key";
  }
  return titleCase(authMethod.replace(/_/g, " "));
}
