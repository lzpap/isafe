import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKey } from './queryKey';
import { useIsafeIndexerClientContext } from '@/contexts/IsafeIndexerClientContext';

export function useGetAccountsForAddress(address: string) {
    const indexerClient = useIsafeIndexerClientContext();
    const infiniteQuery = useInfiniteQuery({
        queryKey: queryKey.member_accounts(address),
        queryFn: ({ pageParam }) => indexerClient.getAccountsForAddress(address, pageParam),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!address,
        staleTime: 1000,
        retry: false,
    });

    const allAccounts = infiniteQuery.data?.pages.flatMap(p => p.accounts) ?? [];

    return {
        data: infiniteQuery.data ? allAccounts : undefined,
        isPending: infiniteQuery.isPending,
        isError: infiniteQuery.isError,
        error: infiniteQuery.error,
        fetchNextPage: infiniteQuery.fetchNextPage,
        hasNextPage: infiniteQuery.hasNextPage,
        isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    };
}

export type getAccountsForAddress = {
    accounts: string[];
}
