import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKey } from './queryKey';
import { TransactionSummary } from '@/lib/clients/IsafeIndexerClient';
import { useIsafeIndexerClientContext } from '@/contexts/IsafeIndexerClientContext';

export function useGetSortedAccountTransactions(accountId: string) {
    const indexerClient = useIsafeIndexerClientContext();
    const infiniteQuery = useInfiniteQuery({
        queryKey: queryKey.transactions(accountId),
        queryFn: ({ pageParam }) => indexerClient.getAccountTransactions(accountId, pageParam),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!accountId,
        staleTime: 1000,
        refetchInterval: 3000,
        retry: false,
    });

    const allTransactions = infiniteQuery.data?.pages.flatMap(p => p.transactions) ?? [];

    return {
        data: infiniteQuery.data ? {
            proposed: allTransactions.filter(tx => tx.status === 'Proposed'),
            approved: allTransactions.filter(tx => tx.status === 'Approved'),
            executed: allTransactions.filter(tx => tx.status === 'Executed'),
            rejected: allTransactions.filter(tx => tx.status === 'Rejected'),
        } : undefined,
        isPending: infiniteQuery.isPending,
        isError: infiniteQuery.isError,
        error: infiniteQuery.error,
        fetchNextPage: infiniteQuery.fetchNextPage,
        hasNextPage: infiniteQuery.hasNextPage,
        isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    };
}

export type SortedTransactions = {
    proposed: TransactionSummary[];
    approved: TransactionSummary[];
    executed: TransactionSummary[];
    rejected: TransactionSummary[];
}
