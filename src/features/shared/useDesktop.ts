import { useQuery } from "@tanstack/react-query";
import { getBootstrap, getSnapshot, runInit } from "../../lib/client";
import {
  DESKTOP_BOOTSTRAP_RETRY_LIMIT,
  desktopBootstrapRetryDelay,
} from "../../lib/desktop-timing";
import { isDesktopRuntimeUnavailableError } from "../../lib/tauri";
import { useMutationAwareQueryEnabled } from "./mutationQueue";

export function useDesktop() {
  const readEnabled = useMutationAwareQueryEnabled();
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: getBootstrap,
    retry: (failureCount, error) =>
      isDesktopRuntimeUnavailableError(error) && failureCount < DESKTOP_BOOTSTRAP_RETRY_LIMIT,
    retryDelay: desktopBootstrapRetryDelay,
    enabled: readEnabled,
  });

  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: getSnapshot,
    enabled: useMutationAwareQueryEnabled(bootstrap.data?.runtime_status.compatible ?? false),
    initialData: bootstrap.data?.snapshot ?? undefined,
  });

  const init = useQuery({
    queryKey: ["init"],
    queryFn: runInit,
    enabled: false,
  });

  return {
    bootstrap,
    snapshot,
    init,
  };
}
