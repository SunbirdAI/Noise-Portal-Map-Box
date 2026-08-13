import type { QueryClient } from '@tanstack/react-query';

export function clearPrivateQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey[0] === 'portal' ||
      query.queryKey.some((part) => typeof part === 'string' && part.startsWith('organization:')),
  });
}
