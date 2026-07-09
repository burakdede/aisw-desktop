import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addProfile, updateSettings, useContext, useProfile } from "../../lib/client";

export function useDesktopActions() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["doctor"] });
    await queryClient.invalidateQueries({ queryKey: ["verify"] });
    await queryClient.invalidateQueries({ queryKey: ["backups"] });
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
    useContextMutation: useMutation({
      mutationFn: useContext,
      onSuccess: invalidate,
    }),
    updateSettingsMutation: useMutation({
      mutationFn: updateSettings,
      onSuccess: invalidate,
    }),
  };
}
