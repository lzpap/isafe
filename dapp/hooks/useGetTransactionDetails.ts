import { useQueries } from "@tanstack/react-query";
import { queryKey } from "./queryKey";
import { useTxServiceClientContext } from "@/contexts";
import type { TransactionDetailsResponse } from "@/lib/clients/TxServiceClient";

export function useGetTransactionDetails(transactionDigests: string[]) {
  const txServiceClient = useTxServiceClientContext();

  return useQueries({
    queries: transactionDigests.map((digest) => ({
      queryKey: queryKey.transactionDetails(digest),
      queryFn: async () => {
        return txServiceClient.getTransaction(digest, AbortSignal.timeout(2000));
      },
      retry: false,
    })),
    combine: (results) => {
        const data = results.map((res, i) => {
        if (res.error || res.data == null) {
          return {
            bcs: "",
            sender: "",
            addedAt: 0,
            description: "Failed to find transaction in database",
          } satisfies TransactionDetailsResponse;
        }
        return res.data;
      });
      const isLoading = results.some((res) => res.isLoading);
      return { data, isLoading };
    }
  });
}

export type { TransactionDetailsResponse } from "@/lib/clients/TxServiceClient";