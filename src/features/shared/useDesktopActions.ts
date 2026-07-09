import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
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
import { enqueueMutation, useMutationQueueState } from "./mutationQueue";

export function useDesktopActions() {
  const queryClient = useQueryClient();
  const [apiKeyProfilePending, setApiKeyProfilePending] = useState(false);
  const [apiKeyProfileError, setApiKeyProfileError] = useState<Error | null>(null);
  const mutationLock = useMutationQueueState();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["doctor"] });
    await queryClient.invalidateQueries({ queryKey: ["verify"] });
    await queryClient.invalidateQueries({ queryKey: ["backups"] });
    await queryClient.invalidateQueries({ queryKey: ["init"] });
    await queryClient.invalidateQueries({ queryKey: ["workspace-status"] });
    await queryClient.invalidateQueries({ queryKey: ["project-bindings"] });
  };

  const submitApiKeyProfile = async (input: AddProfileInput) => {
    setApiKeyProfilePending(true);
    setApiKeyProfileError(null);
    try {
      const result = await enqueueMutation("Add profile", () => addProfile(input));
      await invalidate();
      return result;
    } catch (error) {
      const resolved =
        error instanceof Error ? error : new Error("Failed to add API key profile.");
      setApiKeyProfileError(resolved);
      throw resolved;
    } finally {
      setApiKeyProfilePending(false);
    }
  };

  const queueMutation = <TVariables, TResult>(
    label: string,
    mutationFn: (variables: TVariables) => Promise<TResult>,
  ) => {
    return (variables: TVariables) => enqueueMutation(label, () => mutationFn(variables));
  };

  return {
    addProfileMutation: useMutation({
      mutationFn: queueMutation("Add profile", addProfile),
      onSuccess: invalidate,
    }),
    addProfileOAuthMutation: useMutation({
      mutationFn: queueMutation("Add profile", addProfileOAuth),
      onSuccess: invalidate,
    }),
    useProfileMutation: useMutation({
      mutationFn: queueMutation("Switch profile", useProfile),
      onSettled: invalidate,
    }),
    useAllProfilesMutation: useMutation({
      mutationFn: queueMutation("Switch all profiles", useAllProfiles),
      onSettled: invalidate,
    }),
    useContextMutation: useMutation({
      mutationFn: queueMutation("Switch context", useContext),
      onSettled: invalidate,
    }),
    renameProfileMutation: useMutation({
      mutationFn: queueMutation("Rename profile", renameProfile),
      onSuccess: invalidate,
    }),
    removeProfileMutation: useMutation({
      mutationFn: queueMutation("Remove profile", removeProfile),
      onSuccess: invalidate,
    }),
    restoreBackupMutation: useMutation({
      mutationFn: queueMutation("Restore backup", restoreBackup),
      onSuccess: invalidate,
    }),
    updateSettingsMutation: useMutation({
      mutationFn: queueMutation("Update settings", updateSettings),
      onSuccess: invalidate,
    }),
    checkForUpdatesMutation: useMutation({
      mutationFn: checkForUpdates,
    }),
    installUpdateMutation: useMutation({
      mutationFn: installUpdate,
    }),
    initMutation: useMutation({
      mutationFn: () => enqueueMutation("Run setup", runInit),
      onSuccess: invalidate,
    }),
    workspaceBindMutation: useMutation({
      mutationFn: queueMutation("Save workspace binding", workspaceBind),
      onSuccess: invalidate,
    }),
    workspaceUnbindMutation: useMutation({
      mutationFn: queueMutation("Remove workspace binding", workspaceUnbind),
      onSuccess: invalidate,
    }),
    workspaceGuardMutation: useMutation({
      mutationFn: queueMutation("Update workspace guard", workspaceGuard),
      onSuccess: invalidate,
    }),
    apiKeyProfileAction: {
      submit: submitApiKeyProfile,
      isPending: apiKeyProfilePending,
      error: apiKeyProfileError,
      clearError: () => setApiKeyProfileError(null),
    },
    mutationLock,
  };
}
