import type { ProfileSwitchState } from "../../lib/status-display";
import { profileSwitchLabel } from "../../lib/status-display";
import { toolDisplayName } from "../../lib/tool-display";
import type {
  ProfileCredentialBackend,
  ProfileImportMode,
} from "../shared/profile-capabilities";
import { toolApiKeyEnvVar, toolShortName } from "../../lib/tool-registry";
import { credentialBackendLabel as formatCredentialBackendLabel } from "../../lib/credential-backends";

export function profileImportModeLabel(mode: ProfileImportMode) {
  switch (mode) {
    case "from_live":
      return "Import current login";
    case "from_env":
      return "Read from environment";
    case "api_key":
      return "Paste API key";
    case "oauth":
      return "Sign in with OAuth";
  }
}

export function profileImportModeHeading(tool: string, mode: ProfileImportMode) {
  const toolName = toolDisplayName(tool);
  switch (mode) {
    case "from_live":
      return `Import current ${toolName} login`;
    case "from_env":
      return "Read from environment";
    case "api_key":
      return "Paste API key";
    case "oauth":
      return `Sign in to ${toolName}`;
  }
}

export function profileImportModeNotes(tool: string, mode: ProfileImportMode) {
  const toolName = toolDisplayName(tool);
  switch (mode) {
    case "from_live":
      return [`Capture the ${toolName} credentials already active on this Mac.`];
    case "from_env":
      return [
        `Read ${toolApiKeyEnvVar(tool)} from the current environment when you save this profile.`,
      ];
    case "api_key":
      return [
        "Paste the provider key once. AI Switch sends it to the desktop engine without storing it in the form state.",
      ];
    case "oauth":
      return [`Open the normal ${toolName} sign-in flow and keep this sheet open until it finishes.`];
  }
}

export function profileCredentialBackendLabel(backend: ProfileCredentialBackend) {
  return formatCredentialBackendLabel(backend);
}

export function profileCompactSummary(entry: { tool: string; state: ProfileSwitchState }) {
  return `${toolDisplayName(entry.tool)} · ${profileSwitchLabel(entry.state)}`;
}

export function duplicateProfileNameWarning(tool: string, profile: string) {
  return `${toolShortName(tool)} already has a profile named ${profile}. Choose a different name or rename the existing profile first.`;
}
