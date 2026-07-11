import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  activateProfileSet,
  addProfile,
  addProfileOAuth,
  checkForUpdates,
  installUpdate,
  removeProfile,
  renameProfile,
  restoreBackup,
  runInit,
  updateSettings,
  useAllProfiles,
  useContext,
  useProfile,
  workspaceBind,
  workspaceGuard,
  workspaceUnbind,
} from "../../lib/client";
import type { AddProfileInput } from "../../lib/client";
import { DesktopCommandError } from "../../lib/tauri";
import { notifyDesktop } from "../../lib/notifications";
import {
  recordCommandResult,
  useLastCommandResults,
  type CommandResultScope,
} from "./lastCommandResult";
import { enqueueMutation, useMutationQueueState } from "./mutationQueue";
import { invalidatePostMutationQueries } from "./postMutationRefresh";
import { titleCase } from "../../lib/utils";

type WorkspaceTargetInput =
  | {
      kind: "profile_set";
      name: string;
      label?: string;
      matchedTarget: string;
    }
  | {
      kind: "context";
      name: string;
      matchedTarget: string;
      stateMode: string | null;
    };

export function useDesktopActions() {
  const queryClient = useQueryClient();
  const [apiKeyProfilePending, setApiKeyProfilePending] = useState(false);
  const [apiKeyProfileError, setApiKeyProfileError] = useState<Error | null>(null);
  const mutationLock = useMutationQueueState();
  const lastCommandResults = useLastCommandResults();

  const invalidate = async () => invalidatePostMutationQueries(queryClient);

  const submitApiKeyProfile = async (input: AddProfileInput) => {
    setApiKeyProfilePending(true);
    setApiKeyProfileError(null);
    try {
      const result = await enqueueMutation("Add profile", () => addProfile(input));
      recordCommandResult(
        { type: "tool", tool: input.tool },
        {
          label: "Add profile",
          status: "success",
          message: `Saved ${input.tool} profile ${input.profile}.`,
        },
      );
      await invalidate();
      return result;
    } catch (error) {
      const resolved =
        error instanceof Error ? error : new Error("Failed to add API key profile.");
      recordCommandResult(
        { type: "tool", tool: input.tool },
        {
          label: "Add profile",
          status: "error",
          message: resolved.message,
          kind: resolved instanceof DesktopCommandError ? resolved.kind : undefined,
          remediation:
            resolved instanceof DesktopCommandError ? resolved.remediation : undefined,
        },
      );
      setApiKeyProfileError(resolved);
      throw resolved;
    } finally {
      setApiKeyProfilePending(false);
    }
  };

  const queueMutation = <TVariables, TResult>(
    label: string,
    mutationFn: (variables: TVariables) => Promise<TResult>,
    scopeForVariables: (variables: TVariables) => CommandResultScope | null,
    successMessage: (variables: TVariables) => string,
  ) => {
    return async (variables: TVariables) => {
      try {
        const result = await enqueueMutation(label, () => mutationFn(variables));
        const scope = scopeForVariables(variables);
        if (scope) {
          const command =
            typeof result === "object" &&
            result !== null &&
            "command" in result &&
            typeof (result as { command?: unknown }).command === "string"
              ? (result as { command: string }).command
              : undefined;
          recordCommandResult(scope, {
            label,
            status: "success",
            message: successMessage(variables),
            command,
            resultSummary: "Snapshot updated successfully.",
          });
        }
        return result;
      } catch (error) {
        const scope = scopeForVariables(variables);
        if (scope) {
          const resolved = error instanceof Error ? error : new Error(`${label} failed.`);
          recordCommandResult(scope, {
            label,
            status: "error",
            message: resolved.message,
            kind: resolved instanceof DesktopCommandError ? resolved.kind : undefined,
            remediation:
              resolved instanceof DesktopCommandError ? resolved.remediation : undefined,
          });
        }
        throw error;
      }
    };
  };

  const activateWorkspaceTarget = async (variables: WorkspaceTargetInput) => {
    const label = "Use expected project set";
    try {
      const result = await enqueueMutation(label, () =>
        variables.kind === "profile_set"
          ? activateProfileSet({ name: variables.name })
          : useContext({ context: variables.name, stateMode: variables.stateMode }),
      );
      const targetLabel =
        variables.kind === "profile_set" ? variables.label ?? variables.name : variables.name;
      const message = `Switched to ${targetLabel} for ${variables.matchedTarget}.`;
      recordCommandResult(
        { type: "global", id: "workspace" },
        {
          label,
          status: "success",
          message,
        },
      );
      await notifyDesktop({
        title: "Project switch",
        body: message,
      });
      await invalidate();
      return result;
    } catch (error) {
      const resolved = error instanceof Error ? error : new Error(`${label} failed.`);
      recordCommandResult(
        { type: "global", id: "workspace" },
        {
          label,
          status: "error",
          message: resolved.message,
          kind: resolved instanceof DesktopCommandError ? resolved.kind : undefined,
          remediation: resolved instanceof DesktopCommandError ? resolved.remediation : undefined,
        },
      );
      await notifyDesktop({
        title: "Project switch",
        body:
          resolved instanceof DesktopCommandError && resolved.remediation
            ? `${resolved.message} ${resolved.remediation}`
            : resolved.message,
      });
      throw error;
    }
  };

  return {
    addProfileMutation: useMutation({
      mutationFn: queueMutation(
        "Add profile",
        addProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => `Saved ${variables.tool} profile ${variables.profile}.`,
      ),
      onSuccess: invalidate,
    }),
    addProfileOAuthMutation: useMutation({
      mutationFn: queueMutation(
        "Add profile",
        addProfileOAuth,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => `Saved ${variables.tool} profile ${variables.profile}.`,
      ),
      onSuccess: invalidate,
    }),
    useProfileMutation: useMutation({
      mutationFn: queueMutation(
        "Switch profile",
        useProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => `Switched ${titleCase(variables.tool)} to ${variables.label ?? variables.profile}.`,
      ),
      onSettled: invalidate,
    }),
    useAllProfilesMutation: useMutation({
      mutationFn: queueMutation(
        "Switch all profiles",
        useAllProfiles,
        () => ({ type: "global", id: "switch-all" }),
        (variables) => `Switched all tools to ${variables.label ?? variables.profile}.`,
      ),
      onSettled: invalidate,
    }),
    useContextMutation: useMutation({
      mutationFn: queueMutation(
        "Use imported set",
        useContext,
        () => ({ type: "global", id: "context" }),
        (variables) => `Activated imported set ${variables.label ?? variables.context}.`,
      ),
      onSettled: invalidate,
    }),
    activateProfileSetMutation: useMutation({
      mutationFn: queueMutation(
        "Activate profile set",
        activateProfileSet,
        () => ({ type: "global", id: "profile-set" }),
        (variables) => `Activated profile set ${variables.label ?? variables.name}.`,
      ),
      onSettled: invalidate,
    }),
    renameProfileMutation: useMutation({
      mutationFn: queueMutation(
        "Rename profile",
        renameProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => `Renamed ${variables.tool} profile ${variables.oldName} to ${variables.newName}.`,
      ),
      onSuccess: invalidate,
    }),
    removeProfileMutation: useMutation({
      mutationFn: queueMutation(
        "Remove profile",
        removeProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => `Removed ${variables.tool} profile ${variables.profile}.`,
      ),
      onSuccess: invalidate,
    }),
    restoreBackupMutation: useMutation({
      mutationFn: queueMutation(
        "Restore backup",
        restoreBackup,
        () => ({ type: "global", id: "backup" }),
        (backupId) => `Restored backup ${backupId}.`,
      ),
      onSuccess: invalidate,
    }),
    updateSettingsMutation: useMutation({
      mutationFn: queueMutation(
        "Update settings",
        updateSettings,
        () => ({ type: "global", id: "settings" }),
        () => "Saved desktop settings.",
      ),
      onSuccess: invalidate,
    }),
    checkForUpdatesMutation: useMutation({
      mutationFn: checkForUpdates,
    }),
    installUpdateMutation: useMutation({
      mutationFn: installUpdate,
    }),
    initMutation: useMutation({
      mutationFn: async () => {
        try {
          const result = await enqueueMutation("Run setup", runInit);
          recordCommandResult(
            { type: "global", id: "setup" },
            {
              label: "Run setup",
              status: "success",
              message: "Finished setup scan.",
            },
          );
          return result;
        } catch (error) {
          const resolved = error instanceof Error ? error : new Error("Run setup failed.");
          recordCommandResult(
            { type: "global", id: "setup" },
            {
              label: "Run setup",
              status: "error",
              message: resolved.message,
              kind: resolved instanceof DesktopCommandError ? resolved.kind : undefined,
              remediation:
                resolved instanceof DesktopCommandError ? resolved.remediation : undefined,
            },
          );
          throw error;
        }
      },
      onSuccess: async (result) => {
        queryClient.setQueryData(["init"], result);
        await invalidate();
      },
    }),
    workspaceBindMutation: useMutation({
      mutationFn: queueMutation(
        "Save project rule",
        workspaceBind,
        () => ({ type: "global", id: "workspace" }),
        (variables) => `Saved project rule for ${variables.label ?? variables.context}.`,
      ),
      onSuccess: invalidate,
    }),
    workspaceUnbindMutation: useMutation({
      mutationFn: queueMutation(
        "Remove project rule",
        workspaceUnbind,
        () => ({ type: "global", id: "workspace" }),
        () => "Removed project rule.",
      ),
      onSuccess: invalidate,
    }),
    workspaceGuardMutation: useMutation({
      mutationFn: queueMutation(
        "Update project rule guard",
        workspaceGuard,
        () => ({ type: "global", id: "workspace" }),
        (mode) => `Updated project rule guard to ${mode}.`,
      ),
      onSuccess: invalidate,
    }),
    activateWorkspaceTargetMutation: useMutation({
      mutationFn: activateWorkspaceTarget,
    }),
    apiKeyProfileAction: {
      submit: submitApiKeyProfile,
      isPending: apiKeyProfilePending,
      error: apiKeyProfileError,
      clearError: () => setApiKeyProfileError(null),
    },
    mutationLock,
    lastCommandResults,
  };
}
