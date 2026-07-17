import type { QueryClient } from "@tanstack/react-query";
import {
  CORE_DESKTOP_QUERY_KEYS,
  DESKTOP_DIAGNOSTIC_QUERY_KEYS,
  POST_MUTATION_QUERY_KEYS,
  SNAPSHOT_DESKTOP_QUERY_KEYS,
} from "../../lib/desktop-query-keys";

export {
  CORE_DESKTOP_QUERY_KEYS,
  DESKTOP_DIAGNOSTIC_QUERY_KEYS,
  POST_MUTATION_QUERY_KEYS,
  SNAPSHOT_DESKTOP_QUERY_KEYS,
} from "../../lib/desktop-query-keys";

export type PostMutationQueryInvalidator = Pick<QueryClient, "invalidateQueries">;

export async function invalidateDesktopQueries(
  queryClient: PostMutationQueryInvalidator,
  queryKeys: ReadonlyArray<readonly string[]>,
) {
  for (const queryKey of queryKeys) {
    await queryClient.invalidateQueries({ queryKey });
  }
}

export async function invalidatePostMutationQueries(
  queryClient: PostMutationQueryInvalidator,
) {
  await invalidateDesktopQueries(queryClient, POST_MUTATION_QUERY_KEYS);
}

export async function invalidateCoreDesktopQueries(
  queryClient: PostMutationQueryInvalidator,
) {
  await invalidateDesktopQueries(queryClient, CORE_DESKTOP_QUERY_KEYS);
}

export async function invalidateDiagnosticDesktopQueries(
  queryClient: PostMutationQueryInvalidator,
) {
  await invalidateDesktopQueries(queryClient, DESKTOP_DIAGNOSTIC_QUERY_KEYS);
}

export async function invalidateSnapshotDesktopQueries(
  queryClient: PostMutationQueryInvalidator,
) {
  await invalidateDesktopQueries(queryClient, SNAPSHOT_DESKTOP_QUERY_KEYS);
}
