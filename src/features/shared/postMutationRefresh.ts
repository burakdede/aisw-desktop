import type { QueryClient } from "@tanstack/react-query";
import { POST_MUTATION_QUERY_KEYS } from "../../lib/desktop-query-keys";

export { POST_MUTATION_QUERY_KEYS } from "../../lib/desktop-query-keys";

export type PostMutationQueryInvalidator = Pick<QueryClient, "invalidateQueries">;

export async function invalidatePostMutationQueries(
  queryClient: PostMutationQueryInvalidator,
) {
  for (const queryKey of POST_MUTATION_QUERY_KEYS) {
    await queryClient.invalidateQueries({ queryKey });
  }
}
