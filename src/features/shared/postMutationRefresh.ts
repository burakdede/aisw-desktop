import type { QueryClient } from "@tanstack/react-query";

export const POST_MUTATION_QUERY_KEYS = [
  ["bootstrap"],
  ["snapshot"],
  ["doctor"],
  ["verify"],
  ["backups"],
  ["init"],
  ["workspace-status"],
  ["project-bindings"],
] as const;

export type PostMutationQueryInvalidator = Pick<QueryClient, "invalidateQueries">;

export async function invalidatePostMutationQueries(
  queryClient: PostMutationQueryInvalidator,
) {
  for (const queryKey of POST_MUTATION_QUERY_KEYS) {
    await queryClient.invalidateQueries({ queryKey });
  }
}
