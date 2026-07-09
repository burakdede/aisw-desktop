import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addProfile,
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

export function useDesktopActions() {
  const queryClient = useQueryClient();

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

  return {
    addProfileMutation: useMutation({
      mutationFn: addProfile,
      onSuccess: invalidate,
    }),
    useProfileMutation: useMutation({
      mutationFn: useProfile,
      onSuccess: invalidate,
    }),
    useAllProfilesMutation: useMutation({
      mutationFn: useAllProfiles,
      onSuccess: invalidate,
    }),
    useContextMutation: useMutation({
      mutationFn: useContext,
      onSuccess: invalidate,
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
  };
}
