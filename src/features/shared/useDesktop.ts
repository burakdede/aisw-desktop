import { useQuery } from "@tanstack/react-query";
import { getBootstrap, getSnapshot, runInit } from "../../lib/client";
import {
  DESKTOP_BOOTSTRAP_RETRY_LIMIT,
  desktopBootstrapRetryDelay,
} from "../../lib/desktop-timing";
import { DESKTOP_QUERY_KEYS } from "../../lib/desktop-query-keys";
import { isDesktopRuntimeUnavailableError } from "../../lib/tauri";
import { useMutationAwareQueryEnabled } from "./mutationQueue";

export function useDesktop() {
  const readEnabled = useMutationAwareQueryEnabled();
  const bootstrap = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.bootstrap,
    queryFn: getBootstrap,
    retry: (failureCount, error) =>
      isDesktopRuntimeUnavailableError(error) && failureCount < DESKTOP_BOOTSTRAP_RETRY_LIMIT,
    retryDelay: desktopBootstrapRetryDelay,
    enabled: readEnabled,
  });

  const snapshot = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.snapshot,
    queryFn: getSnapshot,
    enabled: useMutationAwareQueryEnabled(bootstrap.data?.runtime_status.compatible ?? false),
    initialData: bootstrap.data?.snapshot ?? undefined,
  });

  const init = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.init,
    queryFn: runInit,
    enabled: false,
  });

  return {
    bootstrap,
    snapshot,
    init,
  };
}
