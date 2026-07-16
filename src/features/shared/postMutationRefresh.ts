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

export async function invalidatePostMutationQueries(queryClient: QueryClient) {
  for (const queryKey of POST_MUTATION_QUERY_KEYS) {
    await queryClient.invalidateQueries({ queryKey });
  }
}
