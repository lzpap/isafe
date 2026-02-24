import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKey } from "./queryKey";
import { useIsafeIndexerClientContext } from "@/contexts";
import type { IsafeEvent } from "@/lib/clients/IsafeIndexerClient";

export type ParsedEvent = IsafeEvent;

export function useGetAccountEvents(address: string) {
  const indexerClient = useIsafeIndexerClientContext();
  const infiniteQuery = useInfiniteQuery({
    queryKey: queryKey.events(address),
    queryFn: ({ pageParam }) => indexerClient.getAccountEvents(address, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!address,
    staleTime: 1000,
    retry: false,
  });

  const allEvents = infiniteQuery.data?.pages.flatMap(p => p.events) ?? [];

  return {
    data: infiniteQuery.data ? allEvents : undefined,
    isPending: infiniteQuery.isPending,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
  };
}
