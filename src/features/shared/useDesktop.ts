import { useQuery } from "@tanstack/react-query";
import { getBootstrap, getSnapshot, runInit } from "../../lib/client";

export function useDesktop() {
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: getBootstrap,
  });

  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: getSnapshot,
    enabled: bootstrap.data?.runtime_status.compatible ?? false,
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
