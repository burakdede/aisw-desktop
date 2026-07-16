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
import { COMMAND_RESULT_GLOBAL_IDS } from "./command-result-scope";
import {
  buildCommandResultError,
  buildCommandResultSuccess,
  resolveCommandResultCommand,
  SNAPSHOT_UPDATED_RESULT_SUMMARY,
} from "./command-result-payload";
import {
  activatedSavedSetMessage,
  activatedSetMessage,
  addProfileSavedMessage,
  DESKTOP_ACTION_RESULT_COPY,
  desktopActionFailureMessage,
  removeProfileMessage,
  removedProjectRuleMessage,
  renameProfileMessage,
  restoreBackupMessage,
  savedProjectRuleMessage,
  switchAllToolsMessage,
  switchedWorkspaceTargetMessage,
  switchProfileMessage,
  updatedProjectRuleGuardMessage,
} from "./desktop-action-result-copy";
import { enqueueMutation, useMutationQueueState } from "./mutationQueue";
import { invalidatePostMutationQueries } from "./postMutationRefresh";

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
      const result = await enqueueMutation(DESKTOP_ACTION_RESULT_COPY.labels.addProfile, () =>
        addProfile(input),
      );
      recordCommandResult(
        { type: "tool", tool: input.tool },
        buildCommandResultSuccess({
          label: DESKTOP_ACTION_RESULT_COPY.labels.addProfile,
          message: addProfileSavedMessage(input.tool, input.profile),
        }),
      );
      await invalidate();
      return result;
    } catch (error) {
      recordCommandResult(
        { type: "tool", tool: input.tool },
        buildCommandResultError(error, {
          label: DESKTOP_ACTION_RESULT_COPY.labels.addProfile,
          fallbackMessage: DESKTOP_ACTION_RESULT_COPY.fallbackMessages.addApiKeyProfile,
        }),
      );
      const resolved =
        error instanceof Error
          ? error
          : new Error(DESKTOP_ACTION_RESULT_COPY.fallbackMessages.addApiKeyProfile);
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
          recordCommandResult(
            scope,
            buildCommandResultSuccess({
              label,
              message: successMessage(variables),
              command: resolveCommandResultCommand(result),
              resultSummary: SNAPSHOT_UPDATED_RESULT_SUMMARY,
            }),
          );
        }
        return result;
      } catch (error) {
        const scope = scopeForVariables(variables);
        if (scope) {
          recordCommandResult(
            scope,
            buildCommandResultError(error, {
              label,
              fallbackMessage: desktopActionFailureMessage(label),
            }),
          );
        }
        throw error;
      }
    };
  };

  const activateWorkspaceTarget = async (variables: WorkspaceTargetInput) => {
    const label = DESKTOP_ACTION_RESULT_COPY.labels.useExpectedProjectSet;
    try {
      const result = await enqueueMutation(label, () =>
        variables.kind === "profile_set"
          ? activateProfileSet({ name: variables.name })
          : useContext({ context: variables.name, stateMode: variables.stateMode }),
      );
      const targetLabel =
        variables.kind === "profile_set" ? variables.label ?? variables.name : variables.name;
      const message = switchedWorkspaceTargetMessage(targetLabel, variables.matchedTarget);
      recordCommandResult(
        { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.workspace },
        buildCommandResultSuccess({
          label,
          message,
        }),
      );
      await notifyDesktop({
        title: DESKTOP_ACTION_RESULT_COPY.fallbackMessages.projectSwitchTitle,
        body: message,
      });
      await invalidate();
      return result;
    } catch (error) {
      recordCommandResult(
        { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.workspace },
        buildCommandResultError(error, {
          label,
          fallbackMessage: desktopActionFailureMessage(label),
        }),
      );
      const resolved =
        error instanceof Error ? error : new Error(desktopActionFailureMessage(label));
      await notifyDesktop({
        title: DESKTOP_ACTION_RESULT_COPY.fallbackMessages.projectSwitchTitle,
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
        DESKTOP_ACTION_RESULT_COPY.labels.addProfile,
        addProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => addProfileSavedMessage(variables.tool, variables.profile),
      ),
      onSuccess: invalidate,
    }),
    addProfileOAuthMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.addProfile,
        addProfileOAuth,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => addProfileSavedMessage(variables.tool, variables.profile),
      ),
      onSuccess: invalidate,
    }),
    useProfileMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.switchProfile,
        useProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) =>
          switchProfileMessage(variables.tool, variables.label, variables.profile),
      ),
      onSettled: invalidate,
    }),
    useAllProfilesMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.switchAllTools,
        useAllProfiles,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.switchAll }),
        (variables) => switchAllToolsMessage(variables.label, variables.profile),
      ),
      onSettled: invalidate,
    }),
    useContextMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.useSet,
        useContext,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.context }),
        (variables) => activatedSetMessage(variables.label, variables.context),
      ),
      onSettled: invalidate,
    }),
    activateProfileSetMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.activateSavedSet,
        activateProfileSet,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.profileSet }),
        (variables) => activatedSavedSetMessage(variables.label, variables.name),
      ),
      onSettled: invalidate,
    }),
    renameProfileMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.renameProfile,
        renameProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) =>
          renameProfileMessage(variables.tool, variables.oldName, variables.newName),
      ),
      onSuccess: invalidate,
    }),
    removeProfileMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.removeProfile,
        removeProfile,
        (variables) => ({ type: "tool", tool: variables.tool }),
        (variables) => removeProfileMessage(variables.tool, variables.profile),
      ),
      onSuccess: invalidate,
    }),
    restoreBackupMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.restoreBackup,
        restoreBackup,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.backup }),
        (backupId) => restoreBackupMessage(backupId),
      ),
      onSuccess: invalidate,
    }),
    updateSettingsMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.updateSettings,
        updateSettings,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.settings }),
        () => DESKTOP_ACTION_RESULT_COPY.fallbackMessages.settingsSaved,
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
          const result = await enqueueMutation(
            DESKTOP_ACTION_RESULT_COPY.labels.runSetup,
            runInit,
          );
          recordCommandResult(
            { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.setup },
            buildCommandResultSuccess({
              label: DESKTOP_ACTION_RESULT_COPY.labels.runSetup,
              message: DESKTOP_ACTION_RESULT_COPY.fallbackMessages.setupComplete,
            }),
          );
          return result;
        } catch (error) {
          recordCommandResult(
            { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.setup },
            buildCommandResultError(error, {
              label: DESKTOP_ACTION_RESULT_COPY.labels.runSetup,
              fallbackMessage: desktopActionFailureMessage(
                DESKTOP_ACTION_RESULT_COPY.labels.runSetup,
              ),
            }),
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
        DESKTOP_ACTION_RESULT_COPY.labels.saveProjectRule,
        workspaceBind,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.workspace }),
        (variables) => savedProjectRuleMessage(variables.label, variables.context),
      ),
      onSuccess: invalidate,
    }),
    workspaceUnbindMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.removeProjectRule,
        workspaceUnbind,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.workspace }),
        () => removedProjectRuleMessage(),
      ),
      onSuccess: invalidate,
    }),
    workspaceGuardMutation: useMutation({
      mutationFn: queueMutation(
        DESKTOP_ACTION_RESULT_COPY.labels.updateProjectRuleGuard,
        workspaceGuard,
        () => ({ type: "global", id: COMMAND_RESULT_GLOBAL_IDS.workspace }),
        (mode) => updatedProjectRuleGuardMessage(mode),
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
