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

export function useDesktopActions() {
  const queryClient = useQueryClient();
  const [apiKeyProfilePending, setApiKeyProfilePending] = useState(false);
  const [apiKeyProfileError, setApiKeyProfileError] = useState<Error | null>(null);

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
      const result = await addProfile(input);
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

  return {
    addProfileMutation: useMutation({
      mutationFn: addProfile,
      onSuccess: invalidate,
    }),
    addProfileOAuthMutation: useMutation({
      mutationFn: addProfileOAuth,
      onSuccess: invalidate,
    }),
    useProfileMutation: useMutation({
      mutationFn: useProfile,
      onSettled: invalidate,
    }),
    useAllProfilesMutation: useMutation({
      mutationFn: useAllProfiles,
      onSettled: invalidate,
    }),
    useContextMutation: useMutation({
      mutationFn: useContext,
      onSettled: invalidate,
    }),
    renameProfileMutation: useMutation({
      mutationFn: renameProfile,
      onSuccess: invalidate,
    }),
    removeProfileMutation: useMutation({
      mutationFn: removeProfile,
      onSuccess: invalidate,
    }),
    restoreBackupMutation: useMutation({
      mutationFn: restoreBackup,
      onSuccess: invalidate,
    }),
    updateSettingsMutation: useMutation({
      mutationFn: updateSettings,
      onSuccess: invalidate,
    }),
    checkForUpdatesMutation: useMutation({
      mutationFn: checkForUpdates,
    }),
    installUpdateMutation: useMutation({
      mutationFn: installUpdate,
    }),
    initMutation: useMutation({
      mutationFn: runInit,
      onSuccess: invalidate,
    }),
    workspaceBindMutation: useMutation({
      mutationFn: workspaceBind,
      onSuccess: invalidate,
    }),
    workspaceUnbindMutation: useMutation({
      mutationFn: workspaceUnbind,
      onSuccess: invalidate,
    }),
    workspaceGuardMutation: useMutation({
      mutationFn: workspaceGuard,
      onSuccess: invalidate,
    }),
    apiKeyProfileAction: {
      submit: submitApiKeyProfile,
      isPending: apiKeyProfilePending,
      error: apiKeyProfileError,
      clearError: () => setApiKeyProfileError(null),
    },
  };
}
