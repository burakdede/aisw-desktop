import { useQuery } from "@tanstack/react-query";
import { getBootstrap, getSnapshot } from "../../lib/client";

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

  return {
    bootstrap,
    snapshot,
  };
}
