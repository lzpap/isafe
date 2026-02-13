import { useQuery } from '@tanstack/react-query';
import { queryKey } from './queryKey';
import { TransactionSummary } from '@/lib/clients/IsafeIndexerClient';
import { useIsafeIndexerClientContext } from '@/contexts/IsafeIndexerClientContext';

export function useGetSortedAccountTransactions(accountId: string) {
    const indexerClient = useIsafeIndexerClientContext();
    return useQuery({
        queryKey: queryKey.transactions(accountId),
        queryFn: async () => {
            // get all transactions from the custom indexer for the account
            const data = await indexerClient.getAccountTransactions(accountId);

            // sort them into proposed, approved, executed
            return {
                proposed: data.filter(tx => tx.status === 'Proposed'),
                approved: data.filter(tx => tx.status === 'Approved'),
                executed: data.filter(tx => tx.status === 'Executed'),
                rejected: data.filter(tx => tx.status === 'Rejected'),
            };
        },
        enabled: !!accountId,
        staleTime: 1000,
        // TODO figure out refetching strategy
        refetchInterval: 3000,
        retry: false,
    });
}

export type SortedTransactions = {
    proposed: TransactionSummary[];
    approved: TransactionSummary[];
    executed: TransactionSummary[];
    rejected: TransactionSummary[];
}